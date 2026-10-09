# Search

Search finds what the public site shows (programs, AI solutions, AI talent and use cases) by their words, with or
without Vietnamese marks, by the start of the word being typed, by typos in titles, and by meaning when an embedding
model is set. It was delivered by [BEY-65](../increments/completed/bey-65-search/design.md), with the embeddings
(BEY-69) and use cases (BEY-70) in the same increment, and the operators' screens by
[BEY-72](../increments/completed/bey-72-ai-providers/design.md). The code is the `search` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/search`. Its checks are in the [verification matrix](../tests/search.md).

## Module

- **Published API.** The package root: `SearchService` (the public search), `SearchAdministration` (Admin › AI),
  `SearchErrorCode` and `SearchException`. Everything else at the root is package-private: the four indexing
  listeners, `IndexRepair`, `SearchEmbeddings`, `EmbeddingClients`, `OpenAiEmbeddings`,
  `EmbeddingVendor`, `EmbeddingSettings`, `Cards` and `Rebuilt`.
- **Persistence.** `search.persistence` holds `SearchDocumentRepository` (`JdbcClient`: the index rows, the ranked
  query and the embedding queue) and the JPA entity `SearchSettings` with its repository. The providers and their keys
  are the [`ai` module](ai.md)'s; search reads its embedding provider through `AiProviders`.
- **Dependencies.** A closed module that may use `ai`, `audit`, `identity`, `organization`, `program`, `solution`, `talent`
  and `usecase`. The owning modules stay the source of truth; the index is a projection that can always be rebuilt
  from them. No other module reads its tables. The module's place in the whole is in
  [ARCHITECTURE.md](../../ARCHITECTURE.md).

## The index

`search_document` (V16, embeddings V31, use cases V40) holds one row per indexed item, keyed by `(kind, item_id)`.
`kind` is `program`, `solution`, `talent` or `use_case`.

- **Shown:** `slug`, `title`, `subtitle`, `summary`, `facets` (a JSON object of what a result card shows besides its
  text), `starts_on` and `ends_on` (a program's dates).
- **Searched:** `keywords` (codes such as industries, roles or skills written as words, `_` becoming a space) and
  `card` (the item's readable text, one piece per line).
- **`listed`:** false only for an approved solution its owner has unlisted.
- **Generated:** `search_vector`, the unaccented `simple` text vector weighted A (title), B (subtitle), C (keywords)
  and D (card), with a GIN index; and `content_hash`, the MD5 of title, subtitle, summary, keywords and card.
- **Embedding:** `embedding` (`vector(1536)`, HNSW index with cosine distance), `embedding_model`, `embedded_hash`
  (the `content_hash` it was made from), `embedding_attempts`, `embedding_next_attempt_at` and `embedding_error`.

`search_unaccent(text)` is an immutable wrapper of `unaccent` with its dictionary named, so it can feed the generated
column; it maps `Đổi mới` to `Doi moi`. The migrations enable `unaccent`, `pg_trgm` and `vector`.

Rules on the rows:

- **A save writes only a change.** `save` is an upsert that leaves a row alone when every column it writes is equal,
  so `indexed_at` is when its content last changed. A row that does change has its embedding attempts and error
  cleared.
- **A row needs a vector** when `embedded_hash` differs from `content_hash` or `embedding_model` is not the model in
  use; nothing else marks it.

## What is indexed

Each kind has a listener class. On the owner's event it reads the item again through the owner's API and saves what
the item is now, or removes the row when the owner returns nothing, so a late or repeated delivery is harmless. The
events are delivered after commit through Spring Modulith's event publication registry.

| Kind       | Event                                    | Read through                             | Indexed while                                                                                                   |
| ---------- | ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `program`  | `ProgramChanged`                         | `ProgramService.indexed`                 | the program is published                                                                                        |
| `solution` | `SolutionChanged`, `OrganizationChanged` | `SolutionDirectory.indexed`, `indexedOf` | the solution is approved and not taken down, and its organization is approved and not taken down; listed or not |
| `talent`   | `TalentProfileChanged`                   | `TalentDirectory.indexed`                | the profile is approved, not taken down, and listed                                                             |
| `use_case` | `UseCaseChanged`, `OrganizationChanged`  | `UseCaseDirectory.indexed`, `indexedOf`  | the use case is approved (published) and has a title, and its organization is approved and not taken down       |

On `OrganizationChanged`, the solution and use case listeners save the organization's items that are still shown
(they carry its name) and remove every other item of that organization.

What each kind puts in its row:

- **Program.** Title the name, subtitle the partner, summary the summary; keywords the type; the card adds `about`.
  Facets `type`, `coverFileId`, `externalUrl`, `applicationsOpenAt`, `applicationsCloseAt`; `starts_on` and `ends_on`
  set.
- **Solution.** Title the name, subtitle the organization's name, summary the summary; keywords the focus areas,
  industries, maturity, deployment and `builtWith`; the card adds problems solved, value proposition, best customer
  profile and traction. Facets `organizationSlug`, `country`, `maturity`, `industries`, `focusAreas`, `photoFileId`
  (its logo, or its organization's when it has none), `customerDeployments` (the count of approved deployments). `listed` follows the solution.
- **Talent.** Title the name, subtitle the headline, summary the bio; keywords the roles, skills and industries; the
  card adds where the person works and their city. Facets `country`, `city`, `worksAt`, `photoFileId`, `roles`,
  `skills`, `industries`.
- **Use case.** The slug is its id. Title the title, subtitle the organization's name, summary and card the expected
  outcomes (its goal); keywords the industry and technologies. Facets `industries`, `closesAt`, `budgetMin`,
  `budgetMax`, `budgetToBeDetermined`, `currency`. Only what the public list of use cases shows is indexed: never the
  problem statement, never the organization's name when the use case hides it, and no budget amounts when the budget
  is for members only.

A facet without a value, or an empty list, is left out of `facets`.

## Repair and rebuild

`IndexRepair` rebuilds every kind in one transaction: it saves every item its owner publishes now and deletes every
other row of that kind. It runs when the application is ready (which also fills an empty index), every night at
03:30 `Asia/Ho_Chi_Minh`, and when an operator asks. One rebuild runs at a time. It logs `search.index.repaired` with
the counts, and keeps the last run (when, items saved, rows removed) in memory until the application stops.

## Public search

`GET /api/search` is open without a session (`SecurityConfiguration`) and served by `SearchService.search`.

| Parameter | Contract                                                                        |
| --------- | ------------------------------------------------------------------------------- |
| `q`       | Required, 1 to 100 characters, not blank                                        |
| `kind`    | Optional: `program`, `solution`, `talent` or `use_case`; every kind when absent |
| `page`    | Optional, 1 to 50, default 1                                                    |

The response, `SearchResults`, holds:

- **`counts`:** how many items of each kind match, and `all`, whatever kind is shown.
- **`items`:** without `kind`, the best 3 of each kind (`PER_KIND`), the kinds in the order of their best item; with
  `kind`, a page of 12 (`PAGE_SIZE`) of that kind, best first, ties broken by title.
- **`page`, `pageSize`, `total`:** `total` counts the kind shown, or every kind.

Each `SearchItem` carries the kind, slug, title, subtitle, summary, the snippet and the facets of its kind as named
members; a member of another kind is null or an empty list. A program also gets its `phase` (`upcoming`, `open`,
`running` or `done`), worked out by `ProgramPhase` at the time of the request.

Rules of the results:

- **Visitors see listed items only.** Every query `SearchService` runs passes `listedOnly`, so an unlisted solution
  is in no visitor's results or counts. The repository can include unlisted rows; no caller in the application does
  today.
- **A use case leaves at its close date.** A row whose `closesAt` facet is past is left out of results and counts at
  query time, without waiting for the repair.
- **The snippet** is the summary, or a person's headline when they have one, with each matched word between U+0002
  and U+0003. `ts_headline` marks the unaccented text and the marks are carried over to the text as written; when the
  two do not line up letter for letter, the text comes back unmarked.
- **The query is never logged.**

## Ranking

`SearchDocumentRepository` ranks up to three ways and fuses them by reciprocal rank: an item's score is the sum of
`1 / (60 + its position)` in each ranking where it appears.

- **By words.** The query is parsed with `websearch_to_tsquery('simple', …)` on its unaccented form and matched
  against `search_vector`, ranked by `ts_rank_cd`. While the last word is being typed it is also taken as a prefix:
  "voice ag" finds "voice agent". A query that ends in a space, a quote or a negated word gets no prefix, and only
  letters and digits of the last word reach `to_tsquery`, so query syntax in the text is only text.
- **By title similarity.** `word_similarity` of the unaccented query to each unaccented title, kept from 0.4, forgives
  a typo. No trigram index serves it.
- **By meaning.** Only when a query vector is available (below): the `pool` nearest rows by cosine distance whose
  vector was made by the same model, kept when their similarity is at least `min-similarity`.

Without a query vector the third ranking is empty and search goes by words alone.

## Embeddings

`SearchEmbeddings` embeds each item's card (cut to 8,000 characters) and each query, with the provider and model set
in Admin › AI. It uses Spring AI's `OpenAiEmbeddingModel` at 1,536 dimensions, a 5-second timeout and one retry;
Spring AI configures no model of its own (`spring.ai.model.embedding: none`).

Configuration, `beyondpilot.search.embedding` in `application.yaml`:

| Property         | Value                           | Meaning                                                                       |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `batch-size`     | `32`                            | Items one request embeds                                                      |
| `interval`       | `1m`                            | Delay between runs of the job, which first runs 30 seconds after start        |
| `min-similarity` | `0.35`                          | Least cosine similarity for a match by meaning                                |
| `pool`           | `48`                            | Nearest rows the meaning branch takes before ranking                          |

Behavior:

- **When it runs.** Only while semantic search is on and the chosen provider has a key that can be opened. Otherwise
  the job sends nothing and every query goes by words.
- **The job.** Each run embeds the next batch of rows needing a vector whose next attempt is due, the longest waiting
  first. A vector is kept only if the row's text did not change meanwhile.
- **A provider that fails** (outage, timeout, rate limit, wrong key) pauses both the job and query embedding for 30
  seconds, then 3 minutes, 20 minutes, 1 hour and 6 hours on consecutive failures; no row is held back for it, and
  search goes by words meanwhile. A success clears the pause.
- **An item the provider refuses** (400 or 422) is retried alone; one refused again is held back, waiting
  `4^attempts` minutes, at most 6 hours, with the kind of failure recorded, never the provider's message.
- **A query the provider refuses** fails alone and pauses nothing, so a visitor cannot switch search by meaning off
  for everyone.
- **Query vectors** of the last 1,000 queries (lower-cased) are kept in memory. They and any pause are forgotten when
  operators change the provider in use, the model or the semantic switch, after that change commits, and the client
  is built again without a restart.
- **A model change** makes every row need a vector again; until a row has one of the new model it is found by words
  only, since vectors of two models are never compared.

## Administration

Admin › AI has two screens of search, the Embedding tab of `/admin/ai/providers` (`?tab=embedding`; the Chat tab is the [`ai` module](ai.md#screen)'s) and `/admin/ai/search-index`, served by `SearchAdminController` at
`/api/search/admin`. Every call requires an operator (`IdentityService.requireOperator`).

| Method and path          | Contract                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /providers`         | The embedding providers, the model in use with how many items it has embedded of the total, the vendors with their address and models, whether keys can be stored, and the settings version. A key is never returned, only `hasKey` |
| `POST /providers`        | Connect a provider; a new one needs `key = replace` and an `apiKey`                                                                                                                                                                 |
| `PUT /providers/{id}`    | Change name, address or key (`keep`, `replace`, `remove`) at the version read                                                                                                                                                       |
| `DELETE /providers/{id}` | Delete a provider and its key, unless search embeds with it                                                                                                                                                                         |
| `POST /providers/test`   | Embed one test sentence with the connection as the editor holds it; nothing is stored. Without `apiKey` the saved key of `providerId` is used                                                                                       |
| `PUT /embedding-model`   | Embed with this provider and model from now on, at the settings version read                                                                                                                                                        |
| `GET /index`             | Per kind: total, listed, embedded, waiting, held back; up to 50 held-back items; semantic state `on`, `off`, `paused` or `no_provider`, with the pause and last batch; the last rebuild                                             |
| `PUT /semantic`          | Turn semantic search on or off at the settings version read                                                                                                                                                                         |
| `POST /index/rebuild`    | Rebuild the index now                                                                                                                                                                                                               |
| `POST /index/retry`      | Let held-back items be tried at the next run: one (`kind` and `itemId`), or all                                                                                                                                                     |

Rules:

- **Vendors.** `openai` at `https://api.openai.com/v1` with `text-embedding-3-large` and `text-embedding-3-small`;
  `openrouter` at `https://openrouter.ai/api/v1` with `openai/text-embedding-3-large` and
  `openai/text-embedding-3-small`. The address must be the vendor's own (a trailing slash is ignored), so the server
  never sends a key to, or calls, another host.
- **Keys.** Sealed by the [`ai` module](ai.md#providers-and-keys) in `ai_provider.api_key` under
  `BEYONDPILOT_AI_ENCRYPTION_KEY`. Without the encryption key no key can be saved and none can be read, so search
  goes by words. A saved key is kept on a change only while the address is unchanged, and a test uses it only for the address
  it was saved with.
- **Names** are unique per purpose, ignoring case.
- **A model is chosen only after the provider embeds a test sentence** with it and returns 1,536 dimensions. A test
  reports `rejected`, `model_refused`, `unreachable` or `wrong_dimensions`.
- **Concurrent changes.** Provider and settings changes carry the version read; a stale one is refused.

`ai_provider` (V42, kept by the `ai` module since V57) holds the providers; search uses the rows whose `purpose` is
`embedding`, with `vendor` `openai` or `openrouter`. `search_settings` (V42) is one row (`id = 1`):
`semantic_enabled` (default true), `provider_id` and `model` (both set or both null), `model_since`, `version` and who
changed it last.

## Errors

Expected failures are `SearchException` with a `SearchErrorCode`, turned into problems by the shared handler.

| Code                                                            | Category            |
| --------------------------------------------------------------- | ------------------- |
| `SEARCH_PROVIDER_NOT_FOUND`                                     | Not found           |
| `SEARCH_PROVIDER_INVALID` (not the vendor's own address)        | Validation          |
| `SEARCH_PROVIDER_KEY_MISSING`                                   | Validation          |
| `SEARCH_MODEL_UNKNOWN` (the vendor does not offer the model)    | Validation          |
| `SEARCH_MODEL_REJECTED` (the test sentence was not embedded)    | Validation          |
| `SEARCH_RETRY_ITEM_INCOMPLETE` (an item named without its kind) | Validation          |
| `SEARCH_PROVIDER_NAME_TAKEN`                                    | Conflict            |
| `SEARCH_PROVIDER_CHANGED`                                       | Conflict            |
| `SEARCH_PROVIDER_IN_USE`                                        | Conflict            |
| `SEARCH_SETTINGS_CHANGED`                                       | Conflict            |
| `SEARCH_ENCRYPTION_KEY_MISSING`                                 | Service unavailable |

## Passages

What a solution's own material says, for matching ([design](../increments/active/bey-39-matching/design.md)). The public search never reads it.

- **`search_passage` (V58)** holds one passage a row: the solution, the source (`deck`, `website` or `customer_case`), the page and the place on the page, the address of a web page, the text, how it was read (`text`, `model` or `unread`), what the source was made from, and the same full-text vector and embedding columns as `search_document`.
- **A passage** is one slide of a deck, one customer case, or a part of a web page: `Passages` cuts a page at line ends into passages of at most 2,000 characters and reads a page to 20,000. Text is never reworded.
- **Customer cases** are written when a solution changes and at a rebuild, and only when they differ from what is kept, so their vectors stay.
- **Decks** are read by a job every `beyondpilot.search.passages.interval` (1 minute), five at a time, for the solutions in the index whose deck file is not the one their passages were made from. PDFBox gives the text of each page, to 80 pages. A page with fewer than 20 characters is kept `unread`; a file that cannot be read leaves one unread page, so it is not tried again.
- **Unread pages** are read by the model operators chose for the task `document_reading` ([AI](ai.md#reading-documents)), five pages a run, the deck with the most first. What it copies is kept with `model`; an empty answer too, so a page is asked for once. Without a model for the task nothing is read.
- **Websites** of imported solutions are loaded once by `infrastructure/legacy-import/passages.py`; a new solution's website waits for BEY-99.
- **Embedding.** The job that embeds the index embeds passages too, `passage-batch-size` (64) a run, under the passage's heading ("Zetamotion, deck page 3"). A new embedding model embeds them again, as it does the index.
- **A solution that is no longer shown** loses its deck and customer case passages; what was loaded for it stays.
- **`SolutionEvidence`** is what [matching](matching.md) reads. `solutionsFor` answers the solutions in the index for a set of queries, unlisted included: each query is searched by its words (any of them, without the words every text holds) and by its meaning, over the profiles and over the passages, where a solution stands at the place of its best passage; the four rankings are fused by reciprocal rank and the queries by adding their scores. `passagesOf` answers what one solution's customer cases, deck and website say.

## Audit

The provider actions are recorded by the `ai` module, which keeps the providers; `SearchAdministration` records the
rest. Each goes through `AuditTrail`
([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)). No key is ever a detail.

| Action                                              | Resource          | Details                                                  |
| --------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `ai.provider_create`                                | `ai_provider`     | `vendor`                                                 |
| `ai.provider_update`                                | `ai_provider`     | `vendor`, `key` (`kept`, `replaced` or `removed`)        |
| `ai.provider_delete`                                | `ai_provider`     | none                                                     |
| `search.model_change`                               | `search_settings` | `model`                                                  |
| `search.semantic_enable`, `search.semantic_disable` | `search_settings` | none; recorded only when the switch changes              |
| `search.index_rebuild`                              | `search_index`    | none                                                     |
| `search.embedding_retry`                            | `search_index`    | `count`; recorded only when at least one item was let go |

Searching, testing a connection and reading the screens are not recorded.
