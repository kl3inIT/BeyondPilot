# Admin: the Audit log screen

Written on 5 October 2026, before drawing the operators' Audit log screen (BEY-49). What other products do with a record of who changed what, and what was taken from them. The screens were read from Mobbin's captures at 768px previews; short strings may be slightly off. GitHub's audit log was read from its documentation, not from a capture.

## What the screen has to do

Show the events the `audit` module has recorded since BEY-48 ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md)), newest first: when, who, what was done and to what. Today there are four actions, all on accounts: `account.disable`, `account.enable`, `operator.grant` and `operator.withdraw`; later modules add theirs. An event may have no actor, when the server configuration made the change. Every stored event is a change that happened: a refused attempt is not recorded. The readers are a handful of operators who ask "who did this, and when?".

## References

| Product     | Capture                                                                                                                                                                                                           | What it shows                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Klaviyo     | [activity log](https://mobbin.com/screens/1f44450b-8a6f-4d19-83e8-24addf2ca0e8)                                                                                                                                   | Three columns only: User (avatar, name over email), Action as a sentence, Time. A search, three selects and a "Last week" timeframe chip with "Clear"                          |
| 1Password   | [activity log](https://mobbin.com/screens/84dbef44-916b-4322-956f-154845c224a7)                                                                                                                                   | Date and time first, then Event, Actor (avatar, name over email), a Description sentence that names the object, IP address                                                     |
| Front       | [audit log](https://mobbin.com/screens/0c2efddc-d2d9-4a17-b589-34523d08e1d8)                                                                                                                                      | Filters as a row of selects above the table: Date range, Updated by, Updated resources, Event; Export at the far right                                                         |
| Vanta       | [event log](https://mobbin.com/screens/41659ab7-5710-4abf-91ca-c6bf482c9b0b)                                                                                                                                      | The date over the time in one cell; the actor's name over their role; a one-sentence description under the title that says what the log is for                                 |
| Railway     | [event panel](https://mobbin.com/screens/3668d9f6-d6bb-4fdf-a4a8-97087947c044)                                                                                                                                    | One event in a panel from the right, in three blocks: When (local time, UTC, ISO), Who, What; the event's identifier at the top                                                |
| Stripe      | [events](https://mobbin.com/screens/5423e185-8374-4b6c-a4a0-2d3ae9adc1d0)                                                                                                                                         | The stored name of the event (`account.application.deauthorized`) shown in monospace beside a sentence; details as label and value pairs before any raw JSON                   |
| WorkOS      | [events](https://mobbin.com/screens/487db82c-a6f6-4371-9c55-2b4f65e3fc3a)                                                                                                                                         | Applied filters as removable chips; the detail beside the list rather than over it                                                                                             |
| Circle      | [member logs](https://mobbin.com/screens/5de52a3a-4801-4f05-86d1-bf3df8d4c769)                                                                                                                                    | "Automated" in the actor column for an event no person performed; paging by Previous and Next only                                                                             |
| HubSpot     | [list activity](https://mobbin.com/screens/96ceeb00-11c7-4544-a962-f38905fb52ed)                                                                                                                                  | Paging by Prev and Next without page numbers                                                                                                                                   |
| Firecrawl   | [empty](https://mobbin.com/screens/1f715851-fd27-4ed6-8002-db98a927ddc8), [date range](https://mobbin.com/screens/f246c14c-1511-4336-90e7-ac3c0aab21b9)                                                           | A period select that defaults to "Last 7 days"; the empty state keeps the filters and the footer in place                                                                      |
| Vercel      | [logs period](https://mobbin.com/screens/8ea0127c-df13-49ea-9568-a82869177f4d)                                                                                                                                    | The period as a short list of presets                                                                                                                                          |
| Reddit      | [mod log, no results](https://mobbin.com/screens/bb42935e-192b-42fd-97ab-d196a19ef49a)                                                                                                                            | "No mod actions found" with one button that resets the filters                                                                                                                 |
| Render      | [events, no results](https://mobbin.com/screens/217f0732-43c2-4459-b45b-daa0d46938f3)                                                                                                                             | The no-results line names the period that was searched                                                                                                                         |
| Toggl Track | [audit log](https://mobbin.com/screens/2deef352-1f6b-4757-a4c9-dcce106b0e6a)                                                                                                                                      | A changed setting shown as "From … → To …" under the sentence                                                                                                                  |
| Okta, Grok  | [Okta](https://mobbin.com/screens/23e31bef-763c-499b-b527-125ea00ff46e), [Grok](https://mobbin.com/screens/bef14bb2-b571-447a-bbf5-a47b25f94b39)                                                                  | The heavy end: from and to with a time and a time zone, a histogram, event identifiers as the first column. Used to see what a small product can leave out                     |
| GitHub      | [organization audit log, documentation](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization) | Entries show the actor, the affected user, the action and the time; search is by qualifiers (`actor:`, `action:`, `created:`), events are kept 180 days, export as JSON or CSV |

Code read in the sibling project MemoryOS, `web/src/features/audit` and `core/.../audit/AuditLog.java`:

- The list has the columns Time, Person, Activity and IP address. The activity is one sentence that ends in the resource's name, and it is the button that opens the event; the whole row is clickable too.
- An event without an actor shows "System".
- Filters are a period select (1, 7, 30 or 90 days), a category select, an outcome select and a search over people and items. They live in the address.
- The list is paged by a cursor over `(occurred_at, id)`, with Previous and Next and no total: "the stream only grows, so there is no total".
- One event opens in a sheet with the blocks When, Who and What, and a before-and-after table when the event carries one.
- It is a Vite application, so it fetches in the browser with TanStack Query and keeps the visited cursors in memory. That part does not transfer to a server-rendered list.

## What the products agree on

- **Newest first, and time is the first or the last column**, never in the middle. Where it comes first the cell holds a date and a time.
- **The actor is a person cell**: avatar, name over a muted address. An event no person performed says so in the same cell.
- **The action reads as a sentence that names its object.** A raw event name appears only as a secondary, monospace line, for readers who search logs.
- **Filters are a row of selects above the table**, with a period among them and a preset as its default. A free date range is offered beside the presets only by products whose readers investigate incidents by the hour.
- **One event opens beside or over the list**, never on a page of its own, and shows label and value pairs grouped as when, who and what.
- **No total and no page numbers** where the log is long: Previous and Next.
- **The empty state keeps the filters** and offers to reset them.
- **Export sits at the top right** in every compliance product, and is absent from the small ones.

## What was taken

| Decision in the drawing                                                                             | From                                |
| --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Columns Time, Person, Activity; nothing else                                                        | Klaviyo, MemoryOS                   |
| The person cell of the Accounts screen, with "System" for an event without an actor                 | 1Password, Circle, MemoryOS         |
| The activity as a sentence ending in the resource's name, which opens the event                     | 1Password, MemoryOS                 |
| A period select with presets, defaulting to the last 7 days, beside an action select and a search   | Firecrawl, Vercel, Front, MemoryOS  |
| A panel from the right with When, Who and What, the stored action name in monospace under the title | Railway, Stripe, MemoryOS           |
| Previous and Next without a total                                                                   | Circle, HubSpot, MemoryOS           |
| No-results state inside the table frame with one action that clears the filters                     | Reddit, Render; the Accounts screen |
| One line under the title that says what the log holds                                               | Vanta                               |
| Stacked rows on a phone                                                                             | The Accounts screen (Mercury)       |

## Left out, and why

- **An outcome filter and badge** (MemoryOS, Okta): only changes that happened are recorded, so every event would read "Success".
- **The source address** (1Password, Okta): the table does not store it.
- **Export, retention wording** (Vanta, Front, GitHub): nothing asks for them yet, and no retention period is decided.
- **A free date range**: four actions and a handful of operators do not need hour-level search; the presets cover it. It can join the period select later without changing the layout.
- **A before-and-after table** (Toggl Track, MemoryOS): no recorded action carries a changed value yet. The panel shows an action's declared details as label and value pairs.

## Not found

- A web capture of an audit log at phone width; Mobbin's web captures are desktop only.
- A product that pages a server-rendered log by cursor in the address. The references that page by cursor keep the cursors in the browser.
