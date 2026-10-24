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
`V114__program_create_luma_connection.sql` creates `program_luma_connection`, and `V116__program_create_luma_registrations.sql`
adds `program.luma_form` and creates `program_luma_registration`. The module owns all six ([data ownership](../../ARCHITECTURE.md#data-ownership-and-consistency)).

- **`program`.** One row per program: `slug`, `name`, `type`, `partner_name`, `summary`, `about`, `starts_on`,
  `ends_on`, `status`, `published_at`, `page_kind`, `external_url`, `cover_file_id`, the application window
  (`applications_open_at`, `applications_close_at`, `shortlist_size`, `outcomes_due_on`, `allow_updates_until_close`),
  the titles an operator gave the dates the window puts on the timeline (`applications_open_title`,
  `applications_close_title`, `outcomes_due_title`, each null for the default words, at most 160 characters),
  `featured_at` (null while the program is not featured), `luma_event_id` (unique; null for a program an operator
  created), `luma_cover_url` (the image on Luma the cover was copied from) and `luma_form` (how people register for
  the event here, as `LumaForm` writes it; null when they register on Luma), `version`, `created_at`, `updated_at`.
- **`program_milestone`** (key dates) and **`program_event`** (events). Lists keyed by `(program_id, position)`, kept
  in the order the operator gave and replaced as a whole, so a row has no identifier of its own.
- **`program_luma_connection`.** At most one row (`id = 1`): the Luma key sealed with AES-256-GCM (`api_key`) and its last
  four characters, the calendar's `calendar_id` and `calendar_name`, the webhook BeyondPilot made (`webhook_id`, its
  secret sealed in `webhook_secret`, or why none was in `webhook_error`), `last_read_at`, `last_read_error`,
  `connected_by_account_id`, `created_at`, `updated_at`, `version`.
- **`program_luma_registration`.** A person's registration for a Luma event, kept for good: `program_id`,
  `account_id` (one per person and event), the `email` and `name` sent to Luma, the `answers` with their questions as
  asked (JSON), `form_version`, the guest's `status` on Luma (`pending_approval`, `approved`, `waitlist`, `declined`,
  `invited`), the `send_state` (`waiting`, `sent`, `failed` with `send_error`), `attempts`, `next_attempt_at`,
  `sent_at`, `luma_guest_id`, `check_in_url`, a unique unguessable `ticket`, `emailed_status`, `created_at`,
  `updated_at`, `version`.
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

| Command                         | Action                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Create                          | `program.create`                                                                              |
| Save, and save of the questions | `program.update`                                                                              |
| Publish                         | `program.publish`                                                                             |
| Unpublish                       | `program.unpublish`                                                                           |
| Feature                         | `program.feature`                                                                             |
| Stop featuring                  | `program.unfeature`                                                                           |
| Read the Luma calendar now      | `program.luma_read`, with `created`, `updated` and `unpublished`; resource `luma_calendar`    |
| Connect the Luma calendar       | `program.luma_connect`, with `calendar`; resource `luma_calendar`                             |
| Disconnect it                   | `program.luma_disconnect`, with `calendar`; resource `luma_calendar`                          |
| Create an event on Luma (MCP)   | `program.luma_event_create`, with `event`; resource the program, or the Luma event until read |
| Change an event on Luma (MCP)   | `program.luma_event_update`, with `event`; resource the program                               |
| Decide a guest on Luma (MCP)    | `program.luma_guest_decide`, with `event`, `guest` and `status`; resource the program         |

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
  the event in full (`GET /v1/events/get`): name, description in Markdown as the host wrote it (`description_md`, else
  the plain `description`), start and end, time zone, kind of place, city and
  country (an ISO code written in English words), cover, page and visibility. Calls carry the key, follow no redirect,
  end after `beyondpilot.program.luma.timeout` and read at most 4 MB; covers are downloaded through `LumaHttp` from the
  configured hosts only (`beyondpilot.program.luma.hosts`, `images.lumacdn.com`), at most 5 MB.
- **Write.** Each event in a transaction of its own. A new one is a program of type `event`: its address is its name
  as a slug (`tinyfish-big-minds`), else the path of its Luma page, else its identifier, with `-2`, `-3`… when taken; a
  held program keeps the address it has; its summary the description's first line as plain text (no heading, list or
  emphasis mark, a link's words without its address) cut at a word to 300 characters, its about the description in
  Markdown, its days the event's local days in its time zone, its page `external` at the
  Luma address, one program event registering there (online, with no city, unless Luma calls the place `offline`), and
  its cover the image copied into storage (`StorageService.keep`). A `public` event is published when it has what
  publishing asks for; a `private` or `members-only` one, or one lacking a cover or a summary, waits as a draft. A held
  one is found by `luma_event_id` and given what Luma says now, overwriting an operator's edit; a read that changes
  nothing writes nothing, and the image is copied again only when its address changes, the replaced cover going after
  the commit. The job changes a held program's status twice only: it publishes a draft never published once its event
  is `public` on Luma and the program has what publishing asks for, so making the event public on Luma makes its page
  public here (an operator's later unpublish stands); and it unpublishes a published one whose event is still to come
  and is no longer on the calendar.
- **Webhook.** `POST /api/program/luma/webhook` takes no session and no CSRF header. A delivery counts only when
  `Webhook-Signature` (`t=<unix seconds>,v1=<hex>`) is the HMAC-SHA256 of `"<t>." + body` with the webhook's secret and
  `t` is within 15 minutes of now (`LumaSignature`), since Luma's retries keep their first `t`; it is then answered
  `204` and the calendar is read soon, once however many deliveries come. Anything else is answered `403`
  (`program.luma.webhook_refused`), never `410`, which would pause the webhook.
- **Registering here.** A managed event without a price whose every question is of a kind Luma documents
  (`LumaForm`, `LumaQuestion`) gets `luma_form` at each read: whether registration is open, whether each guest waits
  for approval, the seats left and the waitlist, the questions, the hosts with their picture on Luma (a form kept
  before hosts had pictures still reads, its hosts by name), the time zone, and the venue or the call with
  whether Luma keeps it for guests. Only events this environment names take registrations here
  (`beyondpilot.program.luma.registration-events`: an identifier each, or `*`; none by default, `*` in production, the
  same on staging), and an event whose name starts with `beyondpilot.program.luma.created-name-prefix`
  when one is set ([Events created from BeyondPilot](#events-created-from-beyondpilot)); their page is `standard`, any
  other keeps Luma's. See [Registrations for Luma events](#registrations-for-luma-events).
- **In Admin.** `AdminProgram` and `AdminProgramSummary` carry `lumaEventId`. The list and the program's screen mark
  such a program **From Luma**, and its Settings say that Luma overwrites its fields at the next read, with a link to
  its Luma page. The **Luma** tab shows the calendar, the key's last four characters, whether the webhook exists, the
  last read or why it failed, and when it was connected.
- **Now.** **Pull from Luma** runs the same read at once (`LumaAdministration.read`), for an operator who just published
  an event; a read already running finishes first, since one read holds the calendar at a time. The toast says what changed.
- **Failures.** A calendar that cannot be read changes nothing and is said on the connection: "Luma could not be read"
  (`program.luma.read_failed`) or "Luma refused the key". An event whose read or write fails is skipped and tried at
  the next read (`program.luma.event_failed`); the others go on. A cover storage cannot keep (a host not configured, an
  answer that is not `2xx`, more than 5 MB, or a type other than PNG, JPEG and WebP, such as a GIF Luma gives an event
  without its own) does not stop the event: its page is made or updated without a new cover, so a page without one
  waits as a draft, and the image is tried again at the next read (`program.luma.cover_skipped`, with the `reason` in
  this server's own words). A read that changed something logs
  `program.luma.read` with its counts.

## Events created from BeyondPilot

An operator creates an event from the operators' MCP server with `create_event`, changes one with `update_event`
(its cover found with `search_event_covers`), and reads and decides its guests with `list_event_guests` and
`decide_guest` (BEY-250; [design](../increments/active/bey-250-create-event-from-mcp/design.md)), through
`EventCreation`, `EventChanges` and `EventGuests`, which first call `IdentityService.requireOperator`. What is made is a draft nobody sees until an
operator publishes it, or until its event is made public on Luma.

- **Found, never made twice.** Every event of the calendar already has its page here. `EventCreation.fromLuma` takes a
  Luma link (`luma.com/event/manage/evt-…`, `luma.com/<path>`, `lu.ma/<path>`, any case, with a query or a trailing
  slash) or an `evt-` identifier, finds the event by identifier (`GET /v1/events/get`) or by its page's path among the
  programs held and then the calendar's events, reads it now with `LumaCalendar.bring`, and answers its program with
  `existing` true when the page was already there; it creates nothing. A link the calendar does not hold is
  `PROGRAM_LUMA_EVENT_NOT_FOUND`, and text that is not a Luma link or identifier is refused before Luma is called.
  `onLuma` answers the page of an event of the same name, as asked or as prefixed, starting the same day instead of
  creating one; `here` answers the page of the calendar's event when the registration link is one of its links, and
  makes a page linking to any other Luma link, such as a partner's.

- **On Luma** (`EventCreation.onLuma`, the default). With the connected calendar's key, `LumaApi.createEvent` sends
  `POST /v1/events/create`: the event `private`, its name, start and end in its time zone, a free-text address (kept
  for guests when asked) or a meeting link, the description, the capacity and waitlist, one free ticket type that
  carries whether guests wait for approval, and the questions, each mapped to Luma's kind (`text`, multi-line `text`,
  `select`, multiple `select`, `url`, `linkedin`, `agree-check`, `company`) with identifiers `bp-1`, `bp-2`…; a select
  needs two options. Then `LumaCalendar.bring` reads that one event as the calendar read does, so its draft program with
  its form exists at once. It waits at most three seconds for a read of the whole calendar already running (Luma's
  webhook for the new event may start one); when it cannot read the event then, the next read brings it, and the answer
  holds no program. Luma is
  called outside any transaction; the creation is audited as `program.luma_event_create` in one of its own. No
  connection is `PROGRAM_LUMA_NOT_CONFIGURED`, a refused key `PROGRAM_LUMA_KEY_REFUSED`, a refused event
  `PROGRAM_LUMA_EVENT_REFUSED`, and Luma out of reach `PROGRAM_LUMA_UNREACHABLE`; nothing is written here then.
- **Staging writes test events.** `beyondpilot.program.luma.created-name-prefix` (`BEYONDPILOT_PROGRAM_LUMA_CREATED_NAME_PREFIX`;
  `[TEST] ` on staging, none by default and in production) starts the name of every event created, since staging's key
  reaches the real calendar; such an event takes registrations here, as the configured test event does.
- **On BeyondPilot alone** (`EventCreation.here`). A draft program of type `event` made as Admin › Programs › New makes
  it, then saved with its summary, about (the description, then the venue and the meeting link), days in the event's
  time zone and one program event; its page is `external` at the registration link when one is given, else
  `standard`. Its address is the name as a slug, with `-2`, `-3`… when taken. The requests are validated as the admin
  screen's are, and audited as `program.create` and `program.update`.
- **Changed** (`EventChanges.change`). The event is named by its page here (`https://…/programs/<slug>`,
  `program:<slug>`, the slug or the program's identifier) or by a Luma link or identifier. With nothing to change it is
  answered as it stands, on Luma with its questions in `create_event`'s types, so a form is read before it is replaced.
  An event of the calendar is changed on Luma, the source of its page: `LumaApi.updateEvent` sends `POST
  /v1/events/update` with the fields given and nothing else (`max_capacity` null for no limit, `suppress_email` true
  only when the operator keeps the guests from Luma's email of a change of name, time or place), then `bring` reads it
  again at once; when that read cannot run now the answer says the page follows. A new start alone keeps the event's
  length. The questions replace the form, and a question sent with the label (any case) and the type it has keeps its
  identifier on Luma, so its answers stay with it; a form with a question of a kind the tool cannot write, or one
  BeyondPilot does not take, is changed on Luma. An event another host lists, a start in the past, an end before the
  start, both a venue and a meeting link, and the fields of a page here alone (`city`, `country`, `summary`,
  `registration_url`) are refused before Luma is called. A change is audited as `program.luma_event_update` with
  `event`; Luma's refusals are the creation's codes. An event on BeyondPilot alone, of type `event`, is saved through
  `ProgramAdministration.save` from what its Settings hold, with its name, its one session's times (days from the given
  time zone, which new times need), place and registration link, its summary, and its about rewritten as at creation
  when a description is given (a venue or a meeting link needs one); Luma's fields are refused, as is a registration
  link of the calendar's event, which has its own page. The address never changes. On Luma a change also takes
  `cover_url`, an image Luma serves (`https://images.lumacdn.com/…`), such as one of the eight `EventChanges.covers`
  finds in Luma's gallery (`GET /v1/images/search`), and `require_approval`, set on every ticket type of the event
  (`GET /v1/events/ticket-types/list`, `POST /v1/events/ticket-types/update`); approval alone does not call
  `events/update`.
- **Guests** (`EventGuests`). The guest list of an event of the calendar is read from Luma (`GET
  /v1/events/guests/list`, filtered by status when asked): each guest's id, name, email, status, when they registered,
  whether they registered here (an address of the program's registrations), and each answer written out (a choice list
  joined, a company with the job title, a box as yes or no). A decision (`approved`, `declined`, `waitlist`,
  `pending_approval`) finds the guest by address or `gst-` id (`GET /v1/events/guests/get`) and sends `POST
  /v1/events/guests/update-status`, with Luma's email to the guest on unless the operator says otherwise and a note of
  at most 200 characters; the same status again sends nothing. It is audited as `program.luma_guest_decide` with
  Luma's ids and the status, not the guest's address, and the event's guests are read again soon
  (`RegistrationDecisions.checkSoon`) so a registration here follows. An event on BeyondPilot alone, one another host
  runs, a guest the event does not have, and `invited` as a decision are refused before anything is sent.

## Registrations for Luma events

People register on BeyondPilot for an event GenAI Fund manages on Luma, become users as they do, and are emailed what
Luma made of it (BEY-245; [design](../increments/active/bey-245-luma-registration/design.md)).

- **Form.** `GET /api/program/programs/{slug}/registration` (`EventRegistrations.registration`) gives the questions as
  the host wrote them, a `formVersion` mark of them, `state` (`open`, `waitlist` when the event is full and its waitlist
  on, `closed`), `approval`, `zone`, `hosts` (each `name` and `avatarUrl`), and the caller's registration. The venue and the call that Luma keeps for
  guests are given only to a confirmed one (`placeKept` says they are kept). A text question labelled Name or Email is
  `known` and answered from the person's own name and address.
- **Registering.** `POST` the same path with the name, the `formVersion` and the answers. The questions are read again
  from Luma first (the ones last read stand when Luma cannot be read); a form filled against others is refused
  (`PROGRAM_REGISTRATION_FORM_CHANGED`) and the calendar is read soon. `RegistrationAnswers` checks each answer, since
  Luma checks none: what is required is there, a choice is one the question offers, an address and a phone number are
  ones. The registration is kept with the status Luma will be asked for: `waitlist` for a full event with a waitlist,
  `pending_approval` when GenAI Fund approves each guest, `approved` otherwise. A second registration of the person is
  refused (`PROGRAM_REGISTRATION_EXISTS`), as is one for an event that takes no more (`PROGRAM_REGISTRATION_CLOSED`).
- **Sending.** `RegistrationSender` sends it after the commit, and every minute any that is due
  (`beyondpilot.program.luma.send-interval`): the event is read again and the status worked out anew from it (one that now takes no registration stops), then `POST /v1/events/guests/add` with that status and `send_email: false`,
  then the guest is read by address (`GET /v1/events/guests/get`), a few times since Luma adds in the background, and
  its identifier, status and check-in address are kept. An attempt that fails waits 1, 5 and 15 minutes, then 1, 3 and 6
  hours, then stops; an address Luma skips (unsubscribed, removed or blocked) and answers Luma refuses stop at once. Each
  outcome is logged (`program.luma.registration_sent`, `registration_failed`, `registration_stopped`).
- **Decisions on Luma.** The webhook also listens to `guest.registered` and `guest.updated` (a webhook made before is
  given them at the first hourly check of a run, `webhooks/update`). A signed guest delivery only names the event: its
  guests are read again (`GET /v1/events/guests/list`, `RegistrationDecisions`), and each registration here takes the
  status and check-in address of its guest, found by identifier, or by address while it has none. Every hour
  (`beyondpilot.program.luma.decision-interval`) the guests of each event still to come with a registration on Luma are
  read the same way, for a delivery that was lost. The page shows the new status; BeyondPilot emails nobody about it,
  since Luma emails the guest of a decision made on Luma (checked on 24 October). A read that changed something logs
  `program.luma.guests_read`; one that failed, `program.luma.guests_failed`.
- **Emails.** Once Luma has the guest, the person is told of its status once (`emailed_status`): received for
  `pending_approval`, waitlisted for `waitlist`, confirmed for `approved` with the check-in code and the calendar file.
  The kinds belong to `notification` (`EmailService.sendEventRegistration*`).
- **Ticket.** `GET /api/program/tickets/{ticket}/check-in.png` draws a confirmed guest's check-in address as a QR code
  (`CheckInCode`), and `GET /api/program/tickets/{ticket}/event.ics` gives the event as a calendar file with the venue
  (`EventCalendar`); both open without a session, by the unguessable ticket, and answer `404` for any other.
- **On the site.** The event's page reads as Luma's (BEY-245, after Kai's review of 24 October): on the left the
  cover, who presents it (GenAI Fund) and the hosts with their pictures, held in view while the page scrolls; on the
  right whether it is free and needs approval, the name, the date as a calendar leaf in the event's own time with a
  calendar file of the name, times and city to save, the place, a short card and the description as Luma formats it
  (`RichText`: Markdown with bold, headings, lists and links opening in a new tab; raw HTML shown as text, images left
  out). The card says how registering goes and welcomes who registers, and its one button opens the questions full
  screen, as Luma does, beside a summary of the event (cover, name, day and hours), above it on a phone, where a bar
  at the foot of the screen keeps the button in reach. In the dialog a
  visitor types their name, address and answers, then the code emailed to them, which signs them in; a new account
  agrees to the consent text there before anything is sent. A program's description elsewhere is shown the same way,
  a plain text keeping its line breaks.

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
| `GET /api/program/programs/{slug}/registration`   | `EventRegistration`; `404` `PROGRAM_NOT_FOUND`, `PROGRAM_REGISTRATION_NOT_HERE`                                                                                                                 |
| `POST /api/program/programs/{slug}/registration`  | `EventRegistration` with the caller's, `received` until Luma has it; `400` `PROGRAM_REGISTRATION_ANSWERS_INVALID`; `401`; `409` `PROGRAM_REGISTRATION_EXISTS`, `_FORM_CHANGED`, `_CLOSED`       |
| `GET /api/program/tickets/{ticket}/check-in.png`  | A confirmed guest's check-in code as PNG; `404` otherwise                                                                                                                                       |
| `GET /api/program/tickets/{ticket}/event.ics`     | A confirmed guest's event as an iCalendar file; `404` otherwise                                                                                                                                 |

The contract is `openapi.yml`.

## Errors

`ProgramErrorCode`, turned into RFC 9457 problems by `config.ApiExceptionHandler`:

| Code                                   | Status | When                                                                                    |
| -------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `PROGRAM_NOT_FOUND`                    | 404    | No program has this id, or no public program this address                               |
| `PROGRAM_SLUG_TAKEN`                   | 409    | Another program has the address                                                         |
| `PROGRAM_SLUG_FIXED`                   | 409    | A new address for a program that has been published                                     |
| `PROGRAM_CHANGED_MEANWHILE`            | 409    | The `version` sent is not the program's                                                 |
| `PROGRAM_QUESTIONS_FIXED`              | 409    | The questions are saved after the applications opened                                   |
| `PROGRAM_OPENING_FIXED`                | 409    | A save moves a passed opening or takes the window away                                  |
| `PROGRAM_PUBLISHED_INCOMPLETE`         | 400    | A save leaves a published program without what publishing asks for                      |
| `PROGRAM_DAYS_OUT_OF_ORDER`            | 400    | `endsOn` before `startsOn`                                                              |
| `PROGRAM_WINDOW_OUT_OF_ORDER`          | 400    | `closesAt` not after `opensAt`                                                          |
| `PROGRAM_OUTCOMES_BEFORE_CLOSE`        | 400    | `outcomesDueOn` before the closing day in Vietnam                                       |
| `PROGRAM_KEY_DATE_OUT_OF_ORDER`        | 400    | A key date ends before it starts                                                        |
| `PROGRAM_EVENT_OUT_OF_ORDER`           | 400    | An event ends before it starts                                                          |
| `PROGRAM_EVENT_CITY_REQUIRED`          | 400    | An event added or changed is held in person and names no city                           |
| `PROGRAM_EXTERNAL_URL_REQUIRED`        | 400    | `external` page kind without `externalUrl`                                              |
| `PROGRAM_CHOICES_REQUIRED`             | 400    | A `single_choice` or `multi_choice` question with fewer than two options                |
| `PROGRAM_NOT_READY_TO_PUBLISH`         | 400    | Publishing while `publishIssues` is not empty                                           |
| `PROGRAM_COVER_NOT_USABLE`             | 400    | The cover is not a stored `program_image` of the caller, or is another program's        |
| `PROGRAM_LUMA_NOT_CONFIGURED`          | 503    | Pull from Luma where no calendar is connected                                           |
| `PROGRAM_LUMA_UNREACHABLE`             | 503    | Pull from Luma, or connecting, when Luma could not be reached                           |
| `PROGRAM_LUMA_KEY_REFUSED`             | 400    | Connecting with a key Luma refuses, or Pull from Luma with a key Luma no longer takes   |
| `PROGRAM_LUMA_ENCRYPTION_KEY_MISSING`  | 503    | Connecting where `BEYONDPILOT_PROGRAM_ENCRYPTION_KEY` is not set                        |
| `PROGRAM_REGISTRATION_NOT_HERE`        | 404    | People register for the event on Luma, or this environment takes no registration for it |
| `PROGRAM_REGISTRATION_CLOSED`          | 409    | The event takes no more registrations                                                   |
| `PROGRAM_REGISTRATION_FORM_CHANGED`    | 409    | The form was filled against questions the host has changed since                        |
| `PROGRAM_REGISTRATION_ANSWERS_INVALID` | 400    | An answer is missing, too long, or not one its question takes                           |
| `PROGRAM_REGISTRATION_EXISTS`          | 409    | The person already registered for the event                                             |
