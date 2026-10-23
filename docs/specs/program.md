# Programs

The programs GenAI Fund runs: what each one is, when it takes applications, its key dates, its events, the questions
it asks applicants, and whether the public site shows it. It was delivered by
[BEY-29](../increments/completed/bey-29-program/design.md). The code is the `program` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/program`. The tests that hold these rules are listed in the
[verification matrix](../tests/program.md).

## Module

- **Published API.** The package root: `ProgramService` (what visitors and other modules read), `ProgramAdministration`
  (what operators do), `ProgramPhase`, `ProgramChanged`, `ApplicationForm`, `ProgramName`, `IndexedProgram`,
  `ProgramErrorCode` and `ProgramException`, and `LumaAdministration` (the Luma calendar operators connect).
  `PublishIssue`, `ReplacedCovers`, `LumaCalendar` and `LumaKeys` are package-private; `program.luma` holds the calls
  to Luma's API, the event as Luma gives it and the webhook's signature.
- **Persistence.** `program.persistence` holds the JPA aggregate `Program` with its value lists `ProgramMilestone`,
  `ProgramEvent` and `ProgramQuestion`, the Spring Data `ProgramRepository`, and `ProgramQueryRepository`, the
  `JdbcClient` reads behind the public list and the operators' list. Enum values are stored as lowercase codes.
- **Dependencies.** Closed, with `allowedDependencies = { "audit", "identity", "shared", "storage" }`: `identity` says
  whether the caller is an operator, `storage` checks and removes the cover file, `shared` writes the list as a
  spreadsheet for a download, and `audit` records each change and each download.
- **Readers.** `proposal` reads `ApplicationForm` (through `applicationForm`, `applicationForms` and
  `formsUnderReview`), `usecase` and `messaging` read `ProgramName` (through `names` and `named`), `search` reads
  `IndexedProgram` (through `indexed` and `indexedAll`) and uses `ProgramPhase` for its result cards, and `mcp` reads
  `ProgramName` through `named` and `IndexedProgram` through `published`.

## Data

`V4__program_create_programs.sql` creates three tables and `V12__program_create_questions.sql` the fourth;
`V86__program_add_window_titles.sql` adds the titles of the window's dates, `V94__program_add_featured_at.sql`
when an operator featured the program and `V99__program_add_luma_event.sql` the Luma event a program was read from.
`V114__program_create_luma_connection.sql` creates `program_luma_connection`. The module owns all five ([data ownership](../../ARCHITECTURE.md#data-ownership-and-consistency)).

- **`program`.** One row per program: `slug`, `name`, `type`, `partner_name`, `summary`, `about`, `starts_on`,
  `ends_on`, `status`, `published_at`, `page_kind`, `external_url`, `cover_file_id`, the application window
  (`applications_open_at`, `applications_close_at`, `shortlist_size`, `outcomes_due_on`, `allow_updates_until_close`),
  the titles an operator gave the dates the window puts on the timeline (`applications_open_title`,
  `applications_close_title`, `outcomes_due_title`, each null for the default words, at most 160 characters),
  `featured_at` (null while the program is not featured), `luma_event_id` (unique; null for a program an operator
  created) and `luma_cover_url` (the image on Luma the cover was copied from), `version`, `created_at`, `updated_at`.
- **`program_milestone`** (key dates) and **`program_event`** (events). Lists keyed by `(program_id, position)`, kept
  in the order the operator gave and replaced as a whole, so a row has no identifier of its own.
- **`program_luma_connection`.** At most one row (`id = 1`): the Luma key sealed with AES-256-GCM (`api_key`) and its last
  four characters, the calendar's `calendar_id` and `calendar_name`, the webhook BeyondPilot made (`webhook_id`, its
  secret sealed in `webhook_secret`, or why none was in `webhook_error`), `last_read_at`, `last_read_error`,
  `connected_by_account_id`, `created_at`, `updated_at`, `version`.
- **`program_question`.** Also keyed by `(program_id, position)`, but each question has an `id`, unique across all
  programs, because an application's answers name their question by it.

Constraints in the database:

- **Address.** `program_slug_key` makes `slug` unique; `program_slug_format` allows lowercase letters, digits and single
  hyphens, 3 to 60 characters.
- **Cover.** `cover_file_id` references `storage_file`, and `program_cover_file_id_key` makes it unique: a cover belongs
  to one program.
- **Order.** `starts_on` is not after `ends_on`; `applications_open_at` is before `applications_close_at`; a key date
  or an event does not end before it starts.
- **Whole window.** `program_window_whole`: the opening and the closing are both set or both null.
- **Values.** `type` is one of `enterprise_challenge`, `open_innovation_call`, `accelerator`, `hackathon`,
  `buildathon`, `grant`, `venture_building`, `pitch_competition`, `event_series`, `event`. `status` is `draft` or
  `published`. `page_kind` is `standard`, `custom` or `external`. A question's `kind` is `short_text`, `long_text`,
  `single_choice`, `multi_choice`, `file`, `link` or `confirm` (`program_question_kind_check`, widened in V74), and its
  `max_length` is 1 to 4000. `shortlist_size` is positive.

## Drafts and publishing

- **Created as a draft.** `POST` takes only `name`, `slug` and `type`; everything else is filled in by later saves.
  Only operators see a draft.
- **What blocks publishing.** A program needs a `summary`, a cover and both `startsOn` and `endsOn`. The program read
  for editing lists what is missing as `publishIssues` (`summary`, `cover`, `dates`, in that order), and `publish`
  checks the same list again and refuses with `PROGRAM_NOT_READY_TO_PUBLISH` while it is not empty. It also gives
  `questionCount`, so that publishing a program whose form asks nothing is asked again; no question is not a block.
- **Publish.** Sets `status` to `published`. The first publication sets `published_at`, which never changes again.
- **Unpublish.** Sets `status` back to `draft` and keeps everything else, the address included.
- **Repeats.** Publishing a published program, or unpublishing a draft, changes nothing, records nothing and publishes
  no event; the answer is still `204`. A published program is not checked again when it is published again.
- **A published program stays complete.** While a program is published, a save that leaves it without what publishing
  asks for is refused with `PROGRAM_PUBLISHED_INCOMPLETE`; it is unpublished first to remove one.
- **The address is fixed once published.** While `published_at` is null a save may change `slug` (if no other program
  has it). From the first publication on, a different `slug` is refused with `PROGRAM_SLUG_FIXED`, whether the program
  is published now or not. The program read for editing carries this as `slugFixed`.
- **A live change is live.** A save of a published program changes the public page at once; there is no separate
  published version.

## Saving

`PUT /api/program/admin/programs/{id}` saves the program as the Settings screen holds it: details, page kind, cover,
application window, key dates and events, all or nothing.

- **Lock and version.** The row is read `PESSIMISTIC_WRITE` (`ProgramRepository.findForUpdate`), and the save is refused
  with `PROGRAM_CHANGED_MEANWHILE` when the `version` sent is not the program's version. The answer carries the new
  version.
- **Lists replaced as sent.** Key dates (at most 30) and events (at most 30) replace the stored lists; an unchanged
  list writes nothing. Sending `applications: null` clears the whole window, its titles included, and resets
  `allowUpdatesUntilClose` to `true`.
- **Titles of the window's dates.** The opening, the close and the day outcomes are due stand on the timeline without
  being key dates: their dates are the window's. `applications.opensTitle`, `closesTitle` and `outcomesTitle` give each
  a title of the operator's; null, or blank, leaves the default words, which the web application writes in the
  reader's language (`Program.timeline` in the message catalogs). The admin read, the public page and both lists
  carry them.
- **Text.** Names and titles are stripped; an optional text that is blank is stored as null.
- **Rules across fields**, each refused with its own code:
  - `endsOn` before `startsOn`: `PROGRAM_DAYS_OUT_OF_ORDER`.
  - `closesAt` not after `opensAt`: `PROGRAM_WINDOW_OUT_OF_ORDER`.
  - `outcomesDueOn` before the day of `closesAt` in Vietnam time: `PROGRAM_OUTCOMES_BEFORE_CLOSE`.
  - A key date or an event whose `endsAt` is before its `startsAt`: `PROGRAM_KEY_DATE_OUT_OF_ORDER`,
    `PROGRAM_EVENT_OUT_OF_ORDER`.
  - An event that is not `online` and has no `city`: `PROGRAM_EVENT_CITY_REQUIRED`. The rule is asked of an event that
    is added or changed. One the program already holds exactly as sent is kept, so a program that held such an event
    before the rule still saves its other fields; the Settings screen asks the same way, in the event's dialog.
  - `pageKind` `external` without `externalUrl`: `PROGRAM_EXTERNAL_URL_REQUIRED`.
- **Single fields.** A malformed member (length, pattern, a web address that is not `http` or `https`) is refused by
  request validation as `REQUEST_INVALID` with a pointer to the member.
- **Races.** Two saves that take the same address or the same cover at once are decided by `program_slug_key` and
  `program_cover_file_id_key`, mapped by constraint name to `PROGRAM_SLUG_TAKEN` and `PROGRAM_COVER_NOT_USABLE`.

## Cover

- **What may be a cover.** A file `storage` holds as stored, with purpose `program_image`, uploaded by the caller, and
  the cover of no other program. Anything else (an unknown file, another person's, a pending upload, another
  purpose) is refused with `PROGRAM_COVER_NOT_USABLE`. Sending the cover the program already has is not checked again.
- **Owned by the program.** When a save names another cover or none, the old file is deleted from `storage` after the
  save commits (`ReplacedCovers`, a `@TransactionalEventListener` in its own transaction). A failed removal is logged as
  `program.cover.removal_failed` and leaves the file behind; the save stands.
- **Read publicly.** The cover is returned as `coverFileId` and read at the public address of stored files
  (`program_image` files are publicly readable).

## Application window and questions

- **The window.** `applications` holds `opensAt`, `closesAt`, `shortlistSize`, `outcomesDueOn` and
  `allowUpdatesUntilClose`. A program without a window takes no applications on BeyondPilot.
- **Open.** Applications are taken from `opensAt` (included) up to `closesAt` (excluded) (`ApplicationForm.openAt`).
- **The form other modules read.** `ApplicationForm` carries the window, the questions in order and the key dates
  sorted by start. `applicationForm` and `applicationForms` return it only for a published program with a window;
  `formsUnderReview` returns it whatever the status, so a program taken off the site is still reviewed.
- **Questions.** `PUT .../{id}/questions` replaces the list in the order sent, at most 20, under the same lock and
  version check as a save. A question sent with the `id` of one of this program's questions keeps it; any other gets a
  new one.
  - A question answered from choices is `single_choice`, which takes one of them, or `multi_choice`, which takes
    several. Its options are stripped and deduplicated, at most twenty, and fewer than two are refused with
    `PROGRAM_CHOICES_REQUIRED`; other kinds store no options.
  - `maxLength` is kept only for `short_text` and `long_text`; null takes the form's default.
  - Once `opensAt` has passed, the questions are fixed: a save is refused with `PROGRAM_QUESTIONS_FIXED`, and the read
    answers `fixed: true`.
- **The opening is fixed once passed.** Once `opensAt` has passed, a save that moves it or takes the window away is
  refused with `PROGRAM_OPENING_FIXED`, so the program cannot look unopened again and free its questions while answers
  to them exist. `closesAt` and the rest of the window still change. The settings form names a moment to the minute, so
  a save that names the minute of the stored opening keeps the stored opening, seconds included.

## Phase

`ProgramPhase` says where a program stands at a moment. It is never stored; every read works it out from the dates and
the clock. Days are days in Vietnam (`ProgramPhase.ZONE`, `Asia/Ho_Chi_Minh`).

- **`done`** when today is after `endsOn`.
- **`open`** otherwise, while the window is open.
- **`upcoming`** otherwise, when the window has not opened yet or today is before `startsOn`.
- **`running`** in every other case: after the window closed, or with no window, until the last day.

The operators' list shows each program's phase whatever its status.

## Pages

- **Page kinds.** `standard`: the page is built from the program's fields. `custom`: the web application has a page
  written for that address and fills it with the program's data; a `custom` program whose address has no such page is
  shown as a standard page (`web/src/app/[locale]/(public)/programs/[slug]/page.tsx`). `external`: the page is
  somewhere else, at `externalUrl`. The written pages are listed in `web/src/features/program/custom-pages.ts`:
  `insurance-ai-tasco` and `nestle-vietnam-ai-reinvention`. Their long content is fixed for the campaign and lives in
  both message catalogs; the deadline, the timeline, the events and Apply are the program's. Each written page has the
  look its client drew for it, so it may carry its own stylesheet (a CSS module beside the page, with its own custom
  properties prefixed by the program) instead of the site's tokens; nothing in it reaches another page. The Nestlé page
  does: its text is Lexend and its headings Montserrat, as the client drew them, a navigation button and the way to
  apply stay at the foot of the screen, and no breadcrumb or footer of its own is added to the site's.
- **Use cases.** A standard page and the Tasco page list the use cases an operator attached to the program (the Nestlé page, drawn without them, does not), read
  from the public use case list by the program's address (`GET /api/usecase/use-cases?program=`), newest first, its
  first page. A program with none has no such section and no entry for it in the page's navigation; `program` gains
  no dependency on `usecase`, the web page composes the two.
- **One language.** What an operator enters is stored once and shown as entered.
- **Times.** Stored as instants; the web application enters and shows them in Vietnam time.

## Public reading

`SecurityConfiguration` opens `GET /api/program/programs` and `GET /api/program/programs/*` without a session.

- **The list.** Published programs only, the latest to start first (`starts_on desc nulls last`, then newest
  created). Each carries its phase, days, page kind, external address, window and at most three events still to come
  (an event whose end, or start without an end, is not yet past), soonest first. No paging.
- **Filters.** `phase` (`upcoming`, `open`, `running`, `done`) and `type`, both optional; any other value is a `400`
  validation problem.
- **A program's page.** The program at that address with `about`, every key date and every event in the order the
  operator gave. A draft is returned only to an operator, with `status: draft`, so they can preview it; a visitor or a
  user gets `404` `PROGRAM_NOT_FOUND`, as for an unknown address.

## Operators

Every operation of `ProgramAdministration` first calls `IdentityService.requireOperator`, so a caller who is not an
operator now (or whose account is disabled) is refused with `403` `IDENTITY_OPERATOR_REQUIRED`, and a caller without a
session with `401`. The operators' list returns every program in any status without paging, by the phase it is in now: open for
applications, then running, coming up and done. Inside a phase the latest to start is first, and a program with no
start day comes before those, newest created first.

## Audit

Each change is recorded through `AuditTrail` in the transaction of the change, with the operator and the program
(`resource type program`, its id and name) and no details ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)).

| Command                         | Action                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Create                          | `program.create`                                                                           |
| Save, and save of the questions | `program.update`                                                                           |
| Publish                         | `program.publish`                                                                          |
| Unpublish                       | `program.unpublish`                                                                        |
| Feature                         | `program.feature`                                                                          |
| Stop featuring                  | `program.unfeature`                                                                        |
| Read the Luma calendar now      | `program.luma_read`, with `created`, `updated` and `unpublished`; resource `luma_calendar` |
| Connect the Luma calendar       | `program.luma_connect`, with `calendar`; resource `luma_calendar`                          |
| Disconnect it                   | `program.luma_disconnect`, with `calendar`; resource `luma_calendar`                       |

A repeated publish, unpublish, feature or stop records nothing. The Luma job records its create, update, publish and
unpublish with the same actions and no actor.

## Featuring

An operator features a program for the home page's announcement (BEY-188, built as BEY-130 features directory
records). `featured_at` is written only by `ProgramRepository.feature` and `unfeature`, one statement each that leaves
`version` and `updated_at` alone, so featuring never refuses an operator's save; the entity maps it read-only. Any
program can be featured, in any status, and stays featured until an operator stops it. `GET /api/program/programs?featured=true`
lists the featured published programs, the most recently featured first; without the parameter the list keeps its
order and no public record says what is featured. The home page announces the first of them whose applications have not
closed, with its next key date. Featuring publishes no `ProgramChanged`: the indexed program did not change.

## Events from Luma

`LumaCalendar` brings the events of the connected Luma calendar onto the site through Luma's API (BEY-190, BEY-245;
[ADR 0011](../decisions/0011-program-reads-luma-through-its-api.md)). It reads every hour
(`beyondpilot.program.luma.interval`) and soon after a delivery of the calendar's webhook; with no calendar connected
it does nothing, so tests and local runs never call Luma unless a test connects one.

- **Connecting.** On Admin › Programs › **Luma** an operator pastes the calendar's API key (`LumaAdministration.connect`).
  BeyondPilot asks Luma for the key's calendar (`GET /v1/calendars/get`), seals the key with AES-256-GCM under
  `beyondpilot.program.luma.encryption-key` (`BEYONDPILOT_PROGRAM_ENCRYPTION_KEY`, `LumaKeys`), removes a webhook a
  connection before left at its own address, makes one for `calendar.event.added`, `event.created`, `event.updated` and
  `event.canceled` at `<beyondpilot.program.luma.site-url>/api/program/luma/webhook` (`POST /v2/webhooks/create`) and
  seals its secret, then reads the calendar soon after. A webhook that cannot be made is said in `webhook_error`; the
  hourly read goes on. A new key replaces the connection before. Disconnecting removes the webhook on Luma and the row;
  the programs stay. The key and the secret are never returned. Without the encryption key nothing can be connected
  (`PROGRAM_LUMA_ENCRYPTION_KEY_MISSING`), and a key Luma refuses is not kept (`PROGRAM_LUMA_KEY_REFUSED`).
- **Read.** `program.luma.LumaApi` lists the calendar's events, those it manages and those other hosts list on it
  (`GET /v1/calendars/events/list` with `access` `manage` then `view`, page by page). For each event not over it reads
  the event in full (`GET /v1/events/get`): name, plain description, start and end, time zone, kind of place, city and
  country (an ISO code written in English words), cover, page and visibility. Calls carry the key, follow no redirect,
  end after `beyondpilot.program.luma.timeout` and read at most 4 MB; covers are downloaded through `LumaHttp` from the
  configured hosts only (`beyondpilot.program.luma.hosts`, `images.lumacdn.com`), at most 5 MB.
- **Write.** Each event in a transaction of its own. A new one is a program of type `event`: its address is the page's
  path (`gaf-tinyfish-vn`), with `-2`, `-3`… when taken; its summary the description's first line cut at a word to 300
  characters, its about the description, its days the event's local days in its time zone, its page `external` at the
  Luma address, one program event registering there (online, with no city, unless Luma calls the place `offline`), and
  its cover the image copied into storage (`StorageService.keep`). A `public` event is published when it has what
  publishing asks for; a `private` or `members-only` one, or one lacking a cover or a summary, waits as a draft. A held
  one is found by `luma_event_id` and given what Luma says now, overwriting an operator's edit; a read that changes
  nothing writes nothing, and the image is copied again only when its address changes, the replaced cover going after
  the commit. The job never changes a held program's status, except to unpublish a published one whose event is still
  to come and is no longer on the calendar.
- **Webhook.** `POST /api/program/luma/webhook` takes no session and no CSRF header. A delivery counts only when
  `Webhook-Signature` (`t=<unix seconds>,v1=<hex>`) is the HMAC-SHA256 of `"<t>." + body` with the webhook's secret and
  `t` is within 15 minutes of now (`LumaSignature`), since Luma's retries keep their first `t`; it is then answered
  `204` and the calendar is read soon, once however many deliveries come. Anything else is answered `403`
  (`program.luma.webhook_refused`), never `410`, which would pause the webhook.
- **In Admin.** `AdminProgram` and `AdminProgramSummary` carry `lumaEventId`. The list and the program's screen mark
  such a program **From Luma**, and its Settings say that Luma overwrites its fields at the next read, with a link to
  its Luma page. The **Luma** tab shows the calendar, the key's last four characters, whether the webhook exists, the
  last read or why it failed, and when it was connected.
- **Now.** **Pull from Luma** runs the same read at once (`LumaAdministration.read`), for an operator who just published
  an event; a read already running finishes first, since `read` is synchronized. The toast says what changed.
- **Failures.** A calendar that cannot be read changes nothing and is said on the connection: "Luma could not be read"
  (`program.luma.read_failed`) or "Luma refused the key". An event whose read, image or write fails is skipped and tried
  at the next read (`program.luma.event_failed`); the others go on. A read that changed something logs
  `program.luma.read` with its counts.

## Events

- **`ProgramChanged(programId)`** is published inside the transaction by a save, a publication and an unpublication
  (not by a creation or a save of the questions), and by every change the Luma job makes. It names the program only; a listener reads the program as it is
  then through `ProgramService.indexed`, which is empty for a draft. `search` handles it to add or remove the program
  in its index.

## HTTP endpoints

Admin paths need a session, an operator and, for a change, the CSRF header.

| Method and path                                   | Contract                                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/program/programs`                       | `ProgramList` of published programs; optional `phase`, `type` and `featured`                                                                                                                    |
| `GET /api/program/programs/{slug}`                | `Program`; a draft only for an operator; `404` otherwise                                                                                                                                        |
| `GET /api/program/admin/programs`                 | `AdminProgramList`: every program with status, phase and window                                                                                                                                 |
| `POST /api/program/admin/programs`                | `201` with the draft as `AdminProgram`; `409` `PROGRAM_SLUG_TAKEN`                                                                                                                              |
| `POST /api/program/admin/programs/export`         | `200` with the programs the body names, in its order, as XLSX or CSV (`?format=`); a program that does not exist is left out; recorded as `program.export`                                      |
| `GET /api/program/admin/programs/{id}`            | `AdminProgram`, with `publishIssues`, `slugFixed` and `version`                                                                                                                                 |
| `PUT /api/program/admin/programs/{id}`            | `AdminProgram` as saved, with its new version                                                                                                                                                   |
| `GET /api/program/admin/programs/{id}/questions`  | `ProgramQuestions`: the questions, `fixed`, `opensAt`, `version`                                                                                                                                |
| `PUT /api/program/admin/programs/{id}/questions`  | `ProgramQuestions` as saved, with the program's new version                                                                                                                                     |
| `POST /api/program/admin/programs/{id}/publish`   | `204`; `400` `PROGRAM_NOT_READY_TO_PUBLISH`                                                                                                                                                     |
| `POST /api/program/admin/programs/{id}/unpublish` | `204`                                                                                                                                                                                           |
| `POST /api/program/admin/programs/{id}/feature`   | `204`                                                                                                                                                                                           |
| `POST /api/program/admin/programs/{id}/unfeature` | `204`                                                                                                                                                                                           |
| `GET /api/program/admin/luma`                     | `LumaConnection`: whether a key can be kept, and the connected calendar without its key                                                                                                         |
| `PUT /api/program/admin/luma`                     | `LumaConnection` after connecting; `400` `PROGRAM_LUMA_KEY_REFUSED`; `503` `PROGRAM_LUMA_UNREACHABLE`, `PROGRAM_LUMA_ENCRYPTION_KEY_MISSING`                                                    |
| `DELETE /api/program/admin/luma`                  | `204`                                                                                                                                                                                           |
| `POST /api/program/admin/luma/read`               | `LumaRead`: what the read changed; `400` `PROGRAM_LUMA_KEY_REFUSED`; `503` `PROGRAM_LUMA_NOT_CONFIGURED` where no calendar is connected, `PROGRAM_LUMA_UNREACHABLE` when Luma could not be read |
| `POST /api/program/luma/webhook`                  | `204` a delivery signed by the connected calendar; `403` otherwise                                                                                                                              |

The contract is `openapi.yml`.

## Errors

`ProgramErrorCode`, turned into RFC 9457 problems by `config.ApiExceptionHandler`:

| Code                                  | Status | When                                                                                  |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `PROGRAM_NOT_FOUND`                   | 404    | No program has this id, or no public program this address                             |
| `PROGRAM_SLUG_TAKEN`                  | 409    | Another program has the address                                                       |
| `PROGRAM_SLUG_FIXED`                  | 409    | A new address for a program that has been published                                   |
| `PROGRAM_CHANGED_MEANWHILE`           | 409    | The `version` sent is not the program's                                               |
| `PROGRAM_QUESTIONS_FIXED`             | 409    | The questions are saved after the applications opened                                 |
| `PROGRAM_OPENING_FIXED`               | 409    | A save moves a passed opening or takes the window away                                |
| `PROGRAM_PUBLISHED_INCOMPLETE`        | 400    | A save leaves a published program without what publishing asks for                    |
| `PROGRAM_DAYS_OUT_OF_ORDER`           | 400    | `endsOn` before `startsOn`                                                            |
| `PROGRAM_WINDOW_OUT_OF_ORDER`         | 400    | `closesAt` not after `opensAt`                                                        |
| `PROGRAM_OUTCOMES_BEFORE_CLOSE`       | 400    | `outcomesDueOn` before the closing day in Vietnam                                     |
| `PROGRAM_KEY_DATE_OUT_OF_ORDER`       | 400    | A key date ends before it starts                                                      |
| `PROGRAM_EVENT_OUT_OF_ORDER`          | 400    | An event ends before it starts                                                        |
| `PROGRAM_EVENT_CITY_REQUIRED`         | 400    | An event added or changed is held in person and names no city                         |
| `PROGRAM_EXTERNAL_URL_REQUIRED`       | 400    | `external` page kind without `externalUrl`                                            |
| `PROGRAM_CHOICES_REQUIRED`            | 400    | A `single_choice` or `multi_choice` question with fewer than two options              |
| `PROGRAM_NOT_READY_TO_PUBLISH`        | 400    | Publishing while `publishIssues` is not empty                                         |
| `PROGRAM_COVER_NOT_USABLE`            | 400    | The cover is not a stored `program_image` of the caller, or is another program's      |
| `PROGRAM_LUMA_NOT_CONFIGURED`         | 503    | Pull from Luma where no calendar is connected                                         |
| `PROGRAM_LUMA_UNREACHABLE`            | 503    | Pull from Luma, or connecting, when Luma could not be reached                         |
| `PROGRAM_LUMA_KEY_REFUSED`            | 400    | Connecting with a key Luma refuses, or Pull from Luma with a key Luma no longer takes |
| `PROGRAM_LUMA_ENCRYPTION_KEY_MISSING` | 503    | Connecting where `BEYONDPILOT_PROGRAM_ENCRYPTION_KEY` is not set                      |
