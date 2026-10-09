# Matching: references read and a probe on real use cases

Written on 9 October 2026 for BEY-39 and BEY-21. The question: how should BeyondPilot find, for one use case, the solutions already on it that fit, and say why, so that a person can check each reason? Three things were done: open-source projects with a neighbouring problem were read (6 and 7 October), the code of MemoryOS and of Spring AI 2.0.1 was checked for what can be reused (9 October), and a throwaway script ran the whole flow on two real use cases of staging with a strong model (9 October). The script and its answers are in the git-ignored `.tmp/matching-probe/`; nothing of it is committed.

## Sources

Read as code, cloned under `.tmp/matching/`; nothing was run except where the probe says so.

| Source | Commit, date | What it is |
| --- | --- | --- |
| [confused-ai/candisift](https://github.com/confused-ai/candisift) | `e1724ba`, 20 July 2026 | Screens candidates against a job description; the closest in shape |
| [openprose/grant-finder](https://github.com/openprose/grant-finder) | `35e947d`, 13 May 2026 | Finds funding for a profile |
| [GiorgosPanagopoulos/bidpilot](https://github.com/GiorgosPanagopoulos/bidpilot) | `3f7b769`, 7 June 2026 | Matches suppliers to public tenders |
| [firecrawl/fire-enrich](https://github.com/firecrawl/fire-enrich) | `94e061d`, 8 October 2025 | Fills company fields from the web, each with its source |
| [jzhang17/open-websets](https://github.com/jzhang17/open-websets) | `bf93a54`, 6 June 2025 | An open copy of Exa Websets: find companies that meet criteria |
| [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher) | `63fc344`, 5 October 2026 | Matches a résumé to a job description |
| [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher), [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research), [guy-hartstein/company-research-agent](https://github.com/guy-hartstein/company-research-agent) | `0957c30`, `1b7d2e8`, `5b2caa8` | Agents that research on the open web |
| MemoryOS, `D:\MemoryOS` | The team's own product | Search prompts taken from Onyx, a Firecrawl adapter, a PDF view |
| Spring AI 2.0.1 | The backend's version | What ships in its jars and on Maven Central |
| [The method GenAI Fund uses by hand](sources/use-case-solution-research.md) | Received 2 October 2026 | The three buckets and their rules |

No Java or Spring AI project that matches suppliers to needs was found worth reading. The Spring AI pieces are in the note of 5 October ([Spring AI references](2026-10-05-spring-ai-references.md)).

## What the references do, and what is taken

| Finding | Where | Taken |
| --- | --- | --- |
| **The need is turned into requirements before anything is searched**, required apart from optional, each with the passage it comes from | candisift `JDSpec` (`app/candisift/domain/models.py`), Resume-Matcher `EXTRACT_KEYWORDS_PROMPT`, bidpilot `prompts/requirement_extraction/v1.txt`; the hand method: "Distinguish required outcomes from optional integration preferences" | Yes. The probe added a second split, below |
| **Candidates are gathered widely without judgment, then judged strictly** | open-websets (one agent lists, a second qualifies in batches of five), grant-finder (`Research()` returns a packet marked `no_llm`), gpt-researcher ("err on the side of inclusion") | Yes |
| **The model judges requirement by requirement and must quote**, never one overall score | candisift (met, unmet, with verbatim evidence; "If you cannot quote evidence…"), Exa Websets as open-websets copies it (`satisfied`, `reasoning`, `references` per criterion), fire-enrich (`{field}_sources: [{url, quote}]`) | Yes |
| **Code checks the model after it answers, and may only lower its verdict** | candisift `app/candisift/domain/verdict_guard.py`: an unmet must-have caps the recommendation, and evidence whose content words are under 60% in the profile is listed for a human | Yes: a quote not found in the sources lowers its finding to "not shown" |
| **"Not shown" is not "no", and an empty best bucket is allowed** | grant-finder (`no_good_matches`, "checked, no match" apart from "not checked"); the hand method: "An empty Direct Relevance bucket is acceptable", "Unknown means unverified" | Yes. open-websets treats what it cannot verify as failing; that is avoided |
| **What a person decided survives a rerun** | candisift keeps human decisions out of the fingerprint of a run | Yes |
| **Text from outside is data, never instructions** | candisift's prompts | Yes |
| **Prompts are files with a version** | bidpilot `prompts/<name>/v1.txt` | Yes; a run records the version it used |
| **A set of real cases with the answers a person expects**, run again when a prompt changes | grant-finder's recall audit | Needed, and not there yet: see "What the probe cannot tell" |
| One score from 0 to 100 | Resume-Matcher, JobMatch-AI | No: nothing to check it against |
| Matching by structured tags and a fixed formula | bidpilot `app/matching/matcher.py` (sector code, region, budget) | No: tenders carry standard codes; use cases and solutions here are free text |
| Research on the open web | gpt-researcher, open_deep_research, company-research-agent | No: the brief excludes open-web scraping (§17) |

Screens studied on Mobbin on 6 October for the candidate list (Juicebox for a status and a piece of evidence per requirement, Upwork for a ranking without a score, Clay for a run that shows its steps, Airtable for a bin with Restore) are named in the design on BEY-39; the Figma section "AI matching — use case candidates" was drawn from them and approved on 7 October.

## What MemoryOS and Spring AI already have

| Piece | Where | Fits? |
| --- | --- | --- |
| A model rewrites a chat message into one standalone query and up to three keyword queries, then picks the relevant results | MemoryOS `core/.../chat/prompts/SearchPrompts.java` (Onyx's prompts), `chat/tools/SearchTool.java` | The idea of a model writing the queries transfers. The prompts do not: they resolve pronouns, history and source names, which a use case does not have |
| Reading a web page as the Markdown of its main content | MemoryOS `core/.../chat/web/adapter/FirecrawlWebContentAdapter.java` (`POST /v2/scrape`, `onlyMainContent`) behind `WebAdapterRegistry` | Yes, for the websites of new solutions: BEY-99 |
| Showing a PDF in the page | MemoryOS `web/src/features/preview/pdf-view.tsx` on `react-pdf` 11 and `pdfjs-dist` 6 | Yes, for a deck opened at the page a quote comes from |
| Typed answers and a retry when the JSON does not fit | Spring AI `ChatClient…entity(Type)`, `StructuredOutputValidationAdvisor` (in `spring-ai-client-chat-2.0.1.jar`) | Yes |
| Text of a PDF page by page, of Office files, of HTML | `spring-ai-pdf-document-reader`, `spring-ai-tika-document-reader`, `spring-ai-jsoup-document-reader`, each published at 2.0.1 | Yes, the first two |
| A second model that answers whether a claim is supported by a document | Spring AI `FactCheckingEvaluator` (`org.springframework.ai.chat.evaluation`); a stricter prompt in habuma's `decomposed-claim-checking` recipe | Kept for later: the probe did not show the need |
| Query expansion, a vector store, retrieval advisors | `spring-ai-rag`, `PgVectorStore` | No: the index is the hybrid one `search` already has (decided on 5 October) |

## The probe

A script in Python ran the flow on staging's data. It calls the model the way Spring AI's OpenAI client will: the chat completions endpoint, a JSON schema as the response format, and `reasoning_effort`. The model is `cx/gpt-6.1-sol` at medium reasoning through the team's 9Router; the route accepted the schema and the reasoning level.

- **Data.** 230 approved use cases and 2,381 approved solutions (1,978 listed), read from staging. The text of 734 decks and of the websites of 1,939 solutions, saved by the enrichment of BEY-79 on a team machine. All 230 use cases are in English; their text has a median of about 700 characters.
- **Steps.** The model lists the use case's requirements; candidates are found four ways; the 40 best of each way are pooled; the model reads each candidate's profile, customer cases, deck and website and answers per requirement with a quote; code checks every quote against the sources and places the candidate in a bucket.
- **The four ways to find candidates.** A: the solutions nearest to the use case's own embedding. B: the public search of staging with the title and each requirement as a query. C: the same search with queries the model wrote in a vendor's words. D: C, joined with a keyword search (BM25) over the deck and website text, which the index does not hold.

### Numbers

| | Visual quality inspection for automotive components | CRM next-best-action for a bank |
| --- | --- | --- |
| Text of the use case | 4,874 characters | 817 characters |
| Requirements the model listed | 4 capabilities, 6 constraints | 3 capabilities |
| Candidates judged | 76 | 101 |
| Direct / Industry / Technology / none | 0 / 0 / 26 / 50 | 0 / 4 / 23 / 74 |
| Quotes found word for word / nearly / not found | 308 / 12 / 0 | 282 / 18 / 0 |
| Placed candidates among the first 40: A, B, C, D | 17, 15, 20, 19 of 26 | 9, 10, 15, 19 of 27 |
| Industry candidates among the first 40: A, B, C, D | none exist | 0, 1, 1, 3 of 4 |
| Tokens in and out, all candidates | 414,444 and 58,165 | 511,218 and 49,720 |
| Median time of one judgment | 23 s | 16 s |
| Cost of one candidate at the model's list price | $0.019 | $0.015 |

Of the findings with a quote, about four in five quote the website or the deck, and one in five the profile. In all, the probe made 272 calls to the model with 1.38 million tokens in. Its first two runs also had a second model read some candidates again; that was dropped, since only one model is to be used, and its numbers are not reported.

### What the probe showed

1. **The model's quotes are real.** No quote out of more than 600 was missing from the sources. The check in code stays, because it costs nothing, but it is not where errors are caught with this model.
2. **The deck and the website carry the evidence.** A candidate read from its profile alone would lose most of its quotes.
3. **Requirements must be split in two kinds.** In the first run the model marked as required a named edge computer, a data-residency rule, a standard and a numeric target. A vendor's public material almost never proves those, so nobody could reach the best bucket. Split into capabilities (what the product does) and constraints (conditions to confirm with the vendor), the list became usable.
4. **A capability must be one function, in words that fit any industry.** "Recommend cross-sell, up-sell and re-offer actions" was only partly met by a vendor that shows cross-sell and up-sell. "Detect visual defects in automotive components" was only partly met by a vendor of visual inspection for another industry, although the industry is judged on its own.
5. **The rule for the buckets written for the probe is wrong at both ends.** Direct was empty in both use cases, the obvious vendor of the first included; Technology took 23 to 26 candidates, some of them off the subject. The hand method does say that an unverified essential capability disqualifies Direct and that an empty Direct is acceptable, so the strict end may be what GenAI Fund wants. Inside a bucket the order matters more than the bucket.
6. **Where candidates are found depends on the use case.** For a need that names a product category, every way put the right vendors first. For a general business need, the four candidates with a deployment in the industry were not among the 100 nearest to the brief at all; the keyword search over deck and website text found three of them in the first 40.
7. **Queries written by the model were not better on the existing index.** Their gain shows only together with the text of the documents, and the probe cannot tell the two apart.
8. **Seven in ten judgments went to candidates that ended in no bucket**, because the pool was the union of four lists. One fused list of about 40 is enough.
9. **The route has a usage limit.** After about 330 calls in a little over an hour the provider refused with a reset time of two minutes. A run must wait and continue, not fail.

### What the probe cannot tell

- Whether the buckets agree with what GenAI Fund would decide. The "answers" are the model's own. Two or three of the longlists made by hand were asked for (BEY-41).
- Anything about use cases in Vietnamese: there are none.
- How Postgres full-text search compares with the BM25 of the script; the real search is measured again on the same two use cases once built.
- The numbers are from two use cases. They show a direction, not a rate.

## What is taken into the design

- Requirements in two kinds, each capability one function in neutral words, with the passage of the brief it comes from.
- Candidates from the existing search joined with a search over the passages of decks, websites and customer cases, by keywords and by meaning, about 40 judged.
- One judgment per candidate by the model, a quote and its source for every finding; code checks the quotes and decides the bucket and the order.
- A run that waits when the provider says its limit is reached.
- The two use cases of the probe, with the model's saved answers, as the first fixtures for the parts in code.
