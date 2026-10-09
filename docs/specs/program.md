# Programs

The programs GenAI Fund runs: what each one is, when it takes applications, its key dates, its events, the questions
it asks applicants, and whether the public site shows it. It was delivered by
[BEY-29](../increments/completed/bey-29-program/design.md). The code is the `program` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/program`. The tests that hold these rules are listed in the
[verification matrix](../tests/program.md).

## Module

- **Published API.** The package root: `ProgramService` (what visitors and other modules read), `ProgramAdministration`
  (what operators do), `ProgramPhase`, `ProgramChanged`, `ApplicationForm`, `ProgramName`, `IndexedProgram`,
  `ProgramErrorCode` and `ProgramException`. `PublishIssue` and `ReplacedCovers` are package-private.
- **Persistence.** `program.persistence` holds the JPA aggregate `Program` with its value lists `ProgramMilestone`,
  `ProgramEvent` and `ProgramQuestion`, the Spring Data `ProgramRepository`, and `ProgramQueryRepository`, the
  `JdbcClient` reads behind the public list and the operators' list. Enum values are stored as lowercase codes.
- **Dependencies.** Closed, with `allowedDependencies = { "audit", "identity", "storage" }`: `identity` says whether
  the caller is an operator, `storage` checks and removes the cover file, and `audit` records each change.
- **Readers.** `proposal` reads `ApplicationForm` (through `applicationForm`, `applicationForms` and
  `formsUnderReview`), `usecase` reads `ProgramName` (through `names` and `named`), and `search` reads `IndexedProgram`
  (through `indexed` and `indexedAll`) and uses `ProgramPhase` for its result cards.

## Data

`V4__program_create_programs.sql` creates three tables and `V12__program_create_questions.sql` the fourth. The module
owns all four ([data ownership](../../ARCHITECTURE.md#data-ownership-and-consistency)).

- **`program`.** One row per program: `slug`, `name`, `type`, `partner_name`, `summary`, `about`, `starts_on`,
  `ends_on`, `status`, `published_at`, `page_kind`, `external_url`, `cover_file_id`, the application window
  (`applications_open_at`, `applications_close_at`, `shortlist_size`, `outcomes_due_on`, `allow_updates_until_close`),
  `version`, `created_at`, `updated_at`.
- **`program_milestone`** (key dates) and **`program_event`** (events). Lists keyed by `(program_id, position)`, kept
  in the order the operator gave and replaced as a whole, so a row has no identifier of its own.
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
  `single_choice`, `file`, `link` or `confirm`, and its `max_length` is 1 to 4000. `shortlist_size` is positive.

## Drafts and publishing

- **Created as a draft.** `POST` takes only `name`, `slug` and `type`; everything else is filled in by later saves.
  Only operators see a draft.
- **What blocks publishing.** A program needs a `summary`, a cover and both `startsOn` and `endsOn`. The program read
  for editing lists what is missing as `publishIssues` (`summary`, `cover`, `dates`, in that order), and `publish`
  checks the same list again and refuses with `PROGRAM_NOT_READY_TO_PUBLISH` while it is not empty.
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
  list writes nothing. Sending `applications: null` clears the whole window and resets `allowUpdatesUntilClose` to
  `true`.
- **Text.** Names and titles are stripped; an optional text that is blank is stored as null.
- **Rules across fields**, each refused with its own code:
  - `endsOn` before `startsOn`: `PROGRAM_DAYS_OUT_OF_ORDER`.
  - `closesAt` not after `opensAt`: `PROGRAM_WINDOW_OUT_OF_ORDER`.
  - `outcomesDueOn` before the day of `closesAt` in Vietnam time: `PROGRAM_OUTCOMES_BEFORE_CLOSE`.
  - A key date or an event whose `endsAt` is before its `startsAt`: `PROGRAM_KEY_DATE_OUT_OF_ORDER`,
    `PROGRAM_EVENT_OUT_OF_ORDER`.
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
  - A `single_choice` question's options are stripped and deduplicated, and fewer than two are refused with
    `PROGRAM_CHOICES_REQUIRED`; other kinds store no options.
  - `maxLength` is kept only for `short_text` and `long_text`; null takes the form's default.
  - Once `opensAt` has passed, the questions are fixed: a save is refused with `PROGRAM_QUESTIONS_FIXED`, and the read
    answers `fixed: true`.
- **The opening is fixed once passed.** Once `opensAt` has passed, a save that moves it or takes the window away is
  refused with `PROGRAM_OPENING_FIXED`, so the program cannot look unopened again and free its questions while answers
  to them exist. `closesAt` and the rest of the window still change.

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
  somewhere else, at `externalUrl`.
- **Use cases.** A standard page and the Tasco page list the use cases an operator attached to the program, read
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
session with `401`. The operators' list returns every program in any status, newest created first, without paging.

## Audit

Each change is recorded through `AuditTrail` in the transaction of the change, with the operator and the program
(`resource type program`, its id and name) and no details ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)).

| Command                         | Action              |
| ------------------------------- | ------------------- |
| Create                          | `program.create`    |
| Save, and save of the questions | `program.update`    |
| Publish                         | `program.publish`   |
| Unpublish                       | `program.unpublish` |

A repeated publish or unpublish records nothing.

## Events

- **`ProgramChanged(programId)`** is published inside the transaction by a save, a publication and an unpublication
  (not by a creation or a save of the questions). It names the program only; a listener reads the program as it is
  then through `ProgramService.indexed`, which is empty for a draft. `search` handles it to add or remove the program
  in its index.

## HTTP endpoints

Admin paths need a session, an operator and, for a change, the CSRF header.

| Method and path                                   | Contract                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/program/programs`                       | `ProgramList` of published programs; optional `phase` and `type`   |
| `GET /api/program/programs/{slug}`                | `Program`; a draft only for an operator; `404` otherwise           |
| `GET /api/program/admin/programs`                 | `AdminProgramList`: every program with status, phase and window    |
| `POST /api/program/admin/programs`                | `201` with the draft as `AdminProgram`; `409` `PROGRAM_SLUG_TAKEN` |
| `GET /api/program/admin/programs/{id}`            | `AdminProgram`, with `publishIssues`, `slugFixed` and `version`    |
| `PUT /api/program/admin/programs/{id}`            | `AdminProgram` as saved, with its new version                      |
| `GET /api/program/admin/programs/{id}/questions`  | `ProgramQuestions`: the questions, `fixed`, `opensAt`, `version`   |
| `PUT /api/program/admin/programs/{id}/questions`  | `ProgramQuestions` as saved, with the program's new version        |
| `POST /api/program/admin/programs/{id}/publish`   | `204`; `400` `PROGRAM_NOT_READY_TO_PUBLISH`                        |
| `POST /api/program/admin/programs/{id}/unpublish` | `204`                                                              |

The contract is `openapi.yml`.

## Errors

`ProgramErrorCode`, turned into RFC 9457 problems by `config.ApiExceptionHandler`:

| Code                            | Status | When                                                                             |
| ------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `PROGRAM_NOT_FOUND`             | 404    | No program has this id, or no public program this address                        |
| `PROGRAM_SLUG_TAKEN`            | 409    | Another program has the address                                                  |
| `PROGRAM_SLUG_FIXED`            | 409    | A new address for a program that has been published                              |
| `PROGRAM_CHANGED_MEANWHILE`     | 409    | The `version` sent is not the program's                                          |
| `PROGRAM_QUESTIONS_FIXED`       | 409    | The questions are saved after the applications opened                            |
| `PROGRAM_DAYS_OUT_OF_ORDER`     | 400    | `endsOn` before `startsOn`                                                       |
| `PROGRAM_WINDOW_OUT_OF_ORDER`   | 400    | `closesAt` not after `opensAt`                                                   |
| `PROGRAM_OUTCOMES_BEFORE_CLOSE` | 400    | `outcomesDueOn` before the closing day in Vietnam                                |
| `PROGRAM_KEY_DATE_OUT_OF_ORDER` | 400    | A key date ends before it starts                                                 |
| `PROGRAM_EVENT_OUT_OF_ORDER`    | 400    | An event ends before it starts                                                   |
| `PROGRAM_EXTERNAL_URL_REQUIRED` | 400    | `external` page kind without `externalUrl`                                       |
| `PROGRAM_CHOICES_REQUIRED`      | 400    | A `single_choice` question with fewer than two distinct options                  |
| `PROGRAM_NOT_READY_TO_PUBLISH`  | 400    | Publishing while `publishIssues` is not empty                                    |
| `PROGRAM_COVER_NOT_USABLE`      | 400    | The cover is not a stored `program_image` of the caller, or is another program's |
