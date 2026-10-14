# BEY-190 — The events of the GenAI Fund calendar on Luma come onto the site by themselves

Status: approved by Đạt and built on 14 October 2026 ([plan](plan.md)); waits for a look on staging, and for the Tasco demo day to be entered as an event before the release reaches production.

## Why

Kai Yong asked on 14 October 2026: "we also have one event with TinyFish on luma, can you include it there? ideally do it automatically pull", then "can you pull it from the calendar here? https://luma.com/gaf". The day before he had asked that only the future events of `luma.com/gaf` are used ([BEY-183](https://linear.app/beyondpilot/issue/BEY-183)).

Today an operator types every event into Admin, and the home page's events card is written text in `web/messages` (`Home.categories.events.item*`), changed by a release each time.

## Domain story

1. Kai publishes "TinyFish, Big Minds" on the Luma calendar "GenAI Fund - Official".
2. Within the hour BeyondPilot reads the calendar, finds an event still to come that it has not seen, reads the event's page and creates a published program: type event, its page on Luma, its cover, its summary, its dates, and one event with its time and city.
3. A visitor sees it under Coming up on Programs and events, and as one of the next two events on the home page's events card. Choosing it opens its Luma page, where people register.
4. Kai moves the dinner to 19:00 on Luma. At the next read the program's event moves too.
5. An operator does not want one Luma event on BeyondPilot and unpublishes it in Admin. It stays unpublished: the job never changes the status of a program it already holds.
6. Kai deletes a future event on Luma. At the next read the program is unpublished.

Failure paths: Luma does not answer or answers something unreadable (nothing changes; the next run tries again); one event's page cannot be read (that event is skipped this run, the others go on); the event has no cover or no description (the program is created as a draft, which an operator completes and publishes).

## How others do it

Studied on 14 October 2026; clones in `.tmp/luma`.

| Reference                                     | How                                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Luma's own example, `basketball-club-example` | `GET public-api.luma.com/v1/calendar/list-events` with `x-luma-api-key`. The API needs Luma Plus, $59 a month billed annually, and one key per calendar                                  |
| PostHog, `api/luma-events.js`                 | The same API: events after now, a cursor followed for at most five pages, the fields trimmed                                                                                             |
| DevEdmonton, `server/api/import_events.ts`    | A nightly job reads public iCal feeds, Luma calendars among them, and adds the events it has not seen; for a source without a feed it reads each event page's schema.org `Event` JSON-LD |

The calendar's iCal feed (`api2.luma.com/ics/get?entity=calendar&id=cal-KxQE75V2Ywj0ZDI`) is public. Read on 14 October it held 25 events, past ones and ones other hosts list on the calendar included, each with its `UID` (`evt-…@events.lu.ma`), its start and end in UTC and its Luma address in the description; no cover, and the description cut to one line. The event's page carries a schema.org `Event` in JSON-LD: name, full description, start and end with their offset, the images, attendance mode, location and organizer.

## Decisions

| Decision                                                                                                                                                                                                                         | Why                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the public iCal feed for which events exist, and each future event's JSON-LD for what it is; not the API                                                                                                                    | No cost and no secret. The feed and the page together give everything the API would for a program. If GenAI Fund buys Luma Plus, the two reads become one API call and nothing else changes |
| A job in `program` (`program.luma`), every hour; the feed's address in configuration, set for production (and so staging) only                                                                                                   | Luma itself says the feed refreshes every 12 hours, so an hour is ample. No address, no job: tests and local runs never call Luma                                                           |
| Only events still to come are read; past ones are left as they are                                                                                                                                                               | Kai asked for future events. Re-reading the past would bring back events of 2026 that operators never published                                                                             |
| A Luma event is a program: type `event`, page kind `external` to its Luma address, published, with one program event                                                                                                             | The list, the program cards, search and the home page already show such a program; nothing new for a reader                                                                                 |
| `program.luma_event_id` (the feed's `evt-…`), unique, and `program.luma_cover_url`                                                                                                                                               | The event is created once, found again at each read, and its cover downloaded again only when Luma's image changes. Named for Luma, since Luma is the only source                           |
| Luma owns the fields it supplies: name, summary, about, days, external address, the event, the cover. A change on Luma overwrites an operator's edit at the next read; a read that changes nothing writes nothing                | Decided by Đạt on 14 October: one place, Luma, to change an event. Writing only on a difference keeps the version, the audit log and search quiet                                           |
| The job never changes the status of a program it already holds, but unpublishes one whose future event left the feed                                                                                                             | An operator who hides one keeps it hidden. A deleted or cancelled event must not stay on the site                                                                                           |
| A read of the feed that fails, or answers no calendar, changes nothing                                                                                                                                                           | A broken read must not unpublish every event                                                                                                                                                |
| The summary is the description's first paragraph, cut at a word to 300 characters; about is the whole description                                                                                                                | The summary's limit is the Settings screen's (`@Size(max = 300)`)                                                                                                                           |
| Days are the event's local days, taken from the offset Luma gives                                                                                                                                                                | A dinner at 18:00 on 26 October in Ho Chi Minh City is on 26 October                                                                                                                        |
| The address is the Luma path (`gaf-tinyfish-vn`), and `-2`, `-3`… when it is taken                                                                                                                                               | Readable and stable; a program's address is fixed from its first publication                                                                                                                |
| The cover is the JSON-LD's first image, downloaded once into storage as a `program_image`                                                                                                                                        | Every page and Admin show a cover by its file. Luma's CDN answers WebP, PNG or JPEG as asked, which storage takes                                                                           |
| `storage_file.uploaded_by_account_id` becomes nullable, for a file the server stored itself; `StorageService.keep` stores one after checking its purpose, size and content                                                       | No person uploaded the cover. Nothing outside storage reads the uploader                                                                                                                    |
| Calls go only to the hosts configured (`luma.com`, `api2.luma.com`, `images.lumacdn.com`), follow no redirect, end after 10 seconds and read at most 2 MB of a feed or a page and the purpose's largest file of an image         | The job reads addresses that come from a third party's content                                                                                                                              |
| The audit log records the job's create, update, publish and unpublish as the existing `program.*` actions, with no person                                                                                                        | `AuditRecord`'s actor is null "when the server configuration did"; an operator sees what changed and that nobody typed it                                                                   |
| A change publishes `ProgramChanged`, as an operator's save does                                                                                                                                                                  | Search keeps the program as it is                                                                                                                                                           |
| The home page's events card shows the next two events of the published programs, from the public list it already reads, each linked to its registration or its program; with none, one line says that events are announced there | The card stops being a release each time. The 22 October demo day of the Tasco challenge, written in the card today, is entered as an event of that program before the release              |

## What changes

- **Backend, `storage`.** `V98__storage_file_kept_by_server.sql`; `StorageService.keep`; `StoredFile.uploadedByAccountId` nullable.
- **Backend, `program`.** `V99__program_add_luma_event.sql` (numbers checked against `main` before merging); `Program.lumaEventId`, `lumaCoverUrl`; `program.luma`: `LumaCalendar` (the job), `LumaFeed` (the iCal read), `LumaEventPage` (the JSON-LD read), `LumaHttp`, `LumaProperties`; ical4j and jsoup.
- **Web.** `Categories` takes the events; `readUpcomingEvents` in `program-public-queries.ts`; the written rows leave both catalogs; the stub and the Playwright spec of the home page.
- **Documents.** `docs/specs/program.md`, `docs/specs/storage.md`, `docs/tests/program.md`, the roadmap.

## Not done

- No Luma API, and no second calendar.
- No mark in Admin that a program comes from Luma, and no lock on its fields.
- No guests, tickets or registrations from Luma.
