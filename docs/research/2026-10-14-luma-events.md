# Events from Luma: how other sites pull and list them

Studied on 14 October 2026 for [BEY-190](https://linear.app/beyondpilot/issue/BEY-190), after Kai Yong asked that the events of the GenAI Fund calendar on Luma (`luma.com/gaf`) come onto the site by themselves. The repositories were cloned into the git-ignored `.tmp/luma`; the sites were read as served that day.

## How the events are read

| Source                                                                                                                  | How                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Luma's API ([docs](https://docs.luma.com/reference/getting-started-with-your-api), [pricing](https://luma.com/pricing)) | `GET public-api.luma.com/v1/calendar/list-events` with `x-luma-api-key`. Needs Luma Plus, $59 a month billed annually, and one key per calendar |
| Luma's [iCal syncing](https://help.luma.com/p/ical-syncing)                                                             | Every public calendar offers an iCal feed of its published events, with no key. Luma says it refreshes every 12 hours                           |
| [luma-team/basketball-club-example](https://github.com/luma-team/basketball-club-example)                               | Luma's own example: `components/EventList.tsx` reads the API and lists the calendar's events, "No upcoming events." when there are none         |
| [PostHog/posthog.com](https://github.com/PostHog/posthog.com) `api/luma-events.js`                                      | The API, events after now, a cursor followed for at most five pages, the fields trimmed                                                         |
| [devedmonton/DES-Website](https://github.com/devedmonton/DES-Website) `server/api/import_events.ts`                     | A nightly job reads iCal feeds, Luma calendars among them; for a source without a feed it reads each event page's schema.org `Event` JSON-LD    |
| [NebraskaJS](https://github.com/NebraskaJS/nebraskajs.com) `src/loaders/lumaLoader.ts`                                  | A content loader that reads Luma at build time                                                                                                  |

What the feed and the page hold, read on `luma.com/gaf` and `luma.com/gaf-tinyfish-vn`: the feed has 25 events, past ones and ones other hosts list on the calendar included, each with its `UID` (`evt-…@events.lu.ma`), its times in UTC and its Luma address in a description cut to one line; no cover. Its lines end with a line feed alone, so a folded address is cut by a reader that unfolds only `CRLF` and a space. The page's JSON-LD carries the name, the full description, the start and end with their offset, the images, the attendance mode, the place (country as an ISO code) and the organizers. An event may keep its place for those who register: TinyFish, Big Minds has no `location`.

## How the events are listed

| Site                                                                                        | Sections                                                                                                | Each event                                        | Action                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| [MLAI](https://mlai.au/events), Luma API                                                    | "Upcoming Events" and a month calendar; hackathons on a page of their own                               | Day and month, start time, title, venue; no image | **Register**, to Luma        |
| [Thinkin' Rocks](https://www.thinkinrocks.com/events), `EventsList.tsx`                     | Tabs **Upcoming** and **Past**, by date; a hackathon is mixed in with the talks, told only by its title | Cover, date and time, venue, title                | The whole card links to Luma |
| NebraskaJS, `MainEvent.astro`                                                               | One "Next Meetup"                                                                                       | The next event                                    | **Register on Luma**         |
| [Superteam Australia](https://github.com/onaboat/superteam-web-au), `components/events.tsx` | "Join us at upcoming events."                                                                           | The events                                        | A link to the Luma calendar  |

No site lists an event among what can be applied to. Events are listed by date, upcoming apart from past, each with its way to register; the one site that keeps longer programs (MLAI's hackathons) lists them apart from its events, and the one that mixes them (Thinkin' Rocks) leaves a reader to tell them apart by title.

## What BeyondPilot took

- The iCal feed for which events exist and the page's JSON-LD for what each is, rather than the paid API.
- On Programs and events, a program that is an event and nothing else is listed by its event under **Upcoming events**, by date, with its cover and **Register**. **Open now** keeps the programs taking applications, and **Coming up** the programs that have not started.
