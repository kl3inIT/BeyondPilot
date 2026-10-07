# Program: programs, their dates and their pages

Status: accepted on 5 October 2026 and being implemented ([plan](plan.md)). It is the fourth slice of the [Phase 1 domain model](../../active/bey-22-phase-1-domain-model/design.md) and narrows that model's `program` module to what the live site of 9 October needs. The screens are those approved in Figma on 4 and 5 October ([main flows](../../active/bey-27-main-flows-design/design.md)): the programs list, the program page, and in the admin area the Programs list and a program's Settings.

## What a person can do

- A visitor sees the programs GenAI Fund runs: the one taking applications now, what is coming up, and what is done.
- A visitor opens a program and reads what it is, its key dates and its events, and starts an application when applications are open.
- An operator creates a program, fills in its details, its application window, its key dates and its events, adds a cover, and publishes it. Every program is edited this way.
- A program that needs more than the standard page, such as the AI for Insurance Challenge, gets a page written in the web application. Its dates, its events and its application window still come from what the operator entered.

## Boundary discovery

**Story.** An operator opens Programs in the admin area, creates "AI for Insurance Challenge × Tasco" and saves it as a draft. They enter the summary, the window in which applications are taken, the dates of the briefing and the demo day, and the briefing as an event with its registration link; they upload a cover and publish. The program appears on the public list under Open now. When the window closes it stays on the list as running, and after its last day it moves to Done.

- _The address is taken:_ saving is refused with a failure of its own.
- _The window is inconsistent_ (it closes before it opens, or outcomes are due before it closes): saving is refused with a failure that names the rule.
- _A published program is found to be wrong:_ the operator unpublishes it; it leaves the public list and its address answers "not found" until it is published again.

**Glossary.** The terms of the [domain model's glossary](../../active/bey-22-phase-1-domain-model/design.md#glossary) hold. This slice adds:

| Term | Meaning |
| --- | --- |
| Application window | The time between which a program takes applications. A program that takes none on BeyondPilot has no window |
| Key date | A dated step of a program that an applicant plans around: a briefing, the demo day, a decision |
| Event | A session of a program that people register for somewhere else (Luma). It has its own time and place |
| Phase | Where a published program stands today, worked out from its dates: upcoming, open, running or done. It is never stored |
| Page kind | How the public page is made: standard, made for the program, or somewhere else |

**Commands and facts.** Create, update, publish, unpublish. No event is published to other modules yet: `ProgramApplicationsClosed` of the domain model arrives with the review of proposals (BEY-38), its first listener.

**Owner of data and rules.** `program` owns the program, its window, its key dates and its events, and these rules: an address is unique, and fixed from the first publication on; a window opens before it closes; only a published program is public; a phase follows from the dates and the clock alone.

**Communication.** `program` asks `identity` whether the caller is an operator, asks `storage` for the cover it is given, and records each change with `audit` in the same transaction as the change. `proposal` will ask `program` whether a program takes applications now (BEY-37); nothing calls `program` yet.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Every program is edited in the admin area | Programs and Settings, for every program, whatever its page kind | Operators run programs without the team; a page written in code changes how a program looks, never who controls its dates |
| Three page kinds, two built now | `standard`: the page is built from the program's own fields (summary, About, cover, key dates, events, the application window). `custom`: the web application has a page for that address and receives the same data. `external`: the list links to `external_url` | Decided on 3 October. The third way to make a page, free blocks an operator arranges, needs an editor that is not drawn; it follows after 9 October |
| The Tasco challenge is a custom page | Its long content (the question, the directions, the judges, the FAQ) lives in the web application in English and Vietnamese; its dates, events and window come from the API | The page is approved and its content is fixed for this campaign; an editor for it would not be ready by 9 October |
| A custom page falls back | A program marked `custom` whose address has no page in the web application is shown as a standard page | An operator's choice never produces an empty page |
| One language for what an operator enters | Name, summary, About, key dates and events are stored once and shown as entered, in English for now; the page around them is in the visitor's language | Translating by hand doubles the entry work; translation and filling by AI is its own piece of work (BEY-50) |
| An operator previews a draft at its address | `GET /api/program/programs/{slug}` answers an operator's session for a draft too, with `status: draft`; the page shows a banner. Everyone else gets `404` | Organizers see the real page because they are signed in; no product read uses a secret link ([research](../../../research/2026-10-05-program-publish-flow.md)) |
| The phase is derived | `upcoming` before the program starts or its window opens, `open` while the window is open, `running` after the window closes (or with no window) until the last day, `done` after it | A stored status goes stale the minute a deadline passes; the list must be right at 23:59 without anyone acting |
| The three window dates are also key dates | The opening, the closing and the day outcomes are due appear in the timeline, computed from the window; an operator edits them in one place | The Settings screen shows them locked in Key dates for that reason |
| Times | Stored as instants; entered and shown in Vietnam time (ICT), with the zone written beside a deadline | Every program so far is run from Vietnam; a zone per program is a later column if one is needed |
| The address is fixed once published | An operator changes the address freely while the program has never been published; after the first publication it stays, published or not | A shared link must not die because someone tidied a name |
| Two statuses | `draft` and `published`. The domain model's `archived` is added with the first screen that archives | No screen or command uses it yet |
| No paging | Both lists return every program they select | GenAI Fund runs a few programs a year; paging is added when a list is long |
| The partner is a name | `partner_name` as text | `organization` does not exist yet; the link is added when it does (the domain model's decision of 3 October) |
| One save for a program | Settings sends the program with its window, key dates and events together; the lists are replaced as sent | The screen has one Save changes; a program is small, and a half-saved timeline is worse than a refused save |
| Reading the lists | The public list and the admin list are `JdbcClient` queries; the program an operator edits is a JPA aggregate | The split the [persistence guideline](../../../guidelines/persistence.md) gives: screens that list read with SQL, flows that change state use entities |
| The operator's addresses sit under `/admin` | `/api/program/admin/programs`, beside the public `/api/program/programs` | The same collection is read two ways: the public by address and published only, an operator by id and in any status. One path answering differently by caller would hide a draft behind a rule nobody can read from the contract. Accounts needed no such segment because they have no public reading |
| Public reading needs no session | `SecurityConfiguration` permits `GET /api/program/programs` and `GET /api/program/programs/*` | The list and the pages are for visitors; everything under `/admin` stays behind the session and the operator check |
| A rule across members is a failure code | A window that closes before it opens, and the rules like it, answer `400` with a code of their own; a single malformed member answers `REQUEST_INVALID` with a pointer | A module's failure carries a code and no pointer ([API errors](../../../conventions.md#api-errors)); the screen maps each code to the field it sits beside |
| The cover is one program's | A save names a stored `program_image` the caller uploaded; the program then owns it, and removes the file when it names another or none | Nothing else would ever remove a replaced cover, and a file two programs share could not be removed by either |
| What blocks publishing | A summary, a cover and the start and end days. The program read for editing carries them as `publishIssues` (`summary`, `cover`, `dates`); the Settings screen lists them beside a disabled Publish and leads to each field, and the server checks them again when the program is published | The list and the page show the summary and the cover, and the phase needs the days. A list the server computes is what pretix and eventyay do ([research](../../../research/2026-10-05-program-publish-flow.md)) |
| Publishing is its own action | Publish and Unpublish are commands beside Save, each confirmed in the screen; unpublishing keeps everything and the address stays fixed | Going live is a decision with a consequence, the fixed address, and not a field saved with the form; taking a program down must be easy and lose nothing |
| Changes are audited | Create, update, publish and unpublish each record an event (`program.create`, `program.update`, `program.publish`, `program.unpublish`) with the operator and the program | The same rule the accounts screen follows |

## The addresses

| Step | Request | Answer |
| --- | --- | --- |
| The public list | `GET /api/program/programs?phase=&type=`, without a session | Published programs, the latest to start first, with name, address, type, partner, summary, cover, phase, days, page kind, window and their next three events |
| A public program | `GET /api/program/programs/{slug}`, without a session | The same, with About, every key date and every event. The window's three dates are returned in `applications`, and the page places them in the timeline with words in the visitor's language. `404` for a draft, unless an operator asks, and for an unknown address |
| The admin list | `GET /api/program/admin/programs` | Every program with its status, phase and window. `403` for a caller who is not an operator |
| Create | `POST /api/program/admin/programs` with name, address and type | `201` with the draft. `400` naming the member that is malformed; `409` `PROGRAM_SLUG_TAKEN` for a taken address |
| Read for editing | `GET /api/program/admin/programs/{id}` | The whole program as the Settings screen shows it |
| Save | `PUT /api/program/admin/programs/{id}` with the version the screen read | The saved program with its new version. `400` naming the member that is malformed, or with the code of the rule that is broken (`PROGRAM_DAYS_OUT_OF_ORDER`, `PROGRAM_WINDOW_OUT_OF_ORDER`, `PROGRAM_OUTCOMES_BEFORE_CLOSE`, `PROGRAM_KEY_DATE_OUT_OF_ORDER`, `PROGRAM_EVENT_OUT_OF_ORDER`, `PROGRAM_EXTERNAL_URL_REQUIRED`, `PROGRAM_COVER_NOT_USABLE`); `409` `PROGRAM_CHANGED_MEANWHILE` when someone else saved it in the meantime, `PROGRAM_SLUG_TAKEN` or `PROGRAM_SLUG_FIXED` for the address |
| Publish, unpublish | `POST /api/program/admin/programs/{id}/publish`, `…/unpublish` | `204`; repeating either changes nothing and records nothing. Publishing is refused with `400` `PROGRAM_NOT_READY_TO_PUBLISH` while `publishIssues` is not empty |

The counts of applications on the admin list ("8 submitted · 2 to decide") arrive with `proposal`; until then the column is not shown.

## Modules

| Module | Holds | Depends on |
| --- | --- | --- |
| `program` | `ProgramService` (the public reads), `ProgramAdministration` (the operator's changes), `ProgramErrorCode`, `ProgramException`; `web`, `dto`, `persistence` | `identity`, `storage`, `audit` |

The domain model lists `usecase` and `organization` as dependencies of `program`; neither is needed until a program features use cases or links its partner.

## Data

`V4__program_create_programs.sql`:

| Table | Columns |
| --- | --- |
| `program` | `id`, `slug` (unique), `name`, `type` (the ten types of the domain model), `partner_name`, `summary`, `about`, `starts_on`, `ends_on`, `status` (`draft`, `published`), `published_at` (the first publication), `page_kind` (`standard`, `custom`, `external`), `external_url`, `cover_file_id` (unique), the application window, `version`, `created_at`, `updated_at` |
| `program_milestone` | `program_id`, `position` (together the key), `title`, `starts_at`, `ends_at`, `all_day`, `note` |
| `program_event` | `program_id`, `position` (together the key), `title`, `starts_at`, `ends_at`, `online`, `city`, `country`, `registration_url` |

The application window is five columns of `program` (`applications_open_at`, `applications_close_at`, `shortlist_size`, `outcomes_due_on`, `allow_updates_until_close`): it is at most one per program and is saved with it, so a table of its own would add a join and nothing else. The two lists are value collections of the program, kept in the order the operator gave and replaced as a whole, so a row is known by its place and has no identifier.

Against the domain model: `body` becomes `about`; `cover_document_id` becomes `cover_file_id`; `page_kind` and `published_at` are new; `countries` and the `archived` status wait for a screen that uses them; the application settings move onto `program`, lose `timezone`, `scope` and `max_use_cases_per_proposal` until use cases are featured, and gain `shortlist_size` and `outcomes_due_on`, which the Settings screen asks for. `program_question`, `program_use_case`, `program_partner`, `program_person` and `program_section` are not created in this slice.

## The web application

| Path | Shows |
| --- | --- |
| `/programs` | The list as drawn: Open now, Coming up, Done by year |
| `/programs/[slug]` | The standard page, or the page made for that address |
| `/admin/programs` | The admin list and New program |
| `/admin/programs/[id]` | Settings, with the cover upload |

Screens live in `src/features/program/`; the page made for the Tasco challenge is one folder under it, keyed by the program's address. Uploading the cover is the first use of storage from the browser, so the upload helper (reserve, send, confirm) is written here in `src/lib/`.

## Known limits

- A standard page has no free sections: what it shows is the fields above. Blocks, judges and partners with logos follow in the next slice.
- What an operator enters is in one language (BEY-50).
- The ended program with its results table (Agentic AI Build Week) is not built in this slice; a done program links to its recap through `external_url`, or shows the standard page.
- The Overview and Reviewers tabs of a program are not built; Applications arrives with `proposal`.
- Programs and events collected from the blog and Luma are entered through the admin screen; no import exists.
