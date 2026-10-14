# BEY-188 — The featured program is chosen in Admin

Status: proposed on 14 October 2026 ([plan](plan.md)). Nothing is built.

## Why

The home page's featured-program announcement ([BEY-182](https://linear.app/beyondpilot/issue/BEY-182)) is written into the code. The program's address and deadline are constants in `web/src/lib/site.ts` (`featuredProgramSlug`, `featuredProgramDeadline`), its name, lines and dates are in `Home.featured` of both catalogs, and its photograph is `web/public/programs/nestle/building.webp`. Featuring the next program takes a code change and a deployment, and the dates written there can drift from the program's own: the client's mockup still carried Nestlé's old deadline.

Everything the announcement shows is already a field of the program: its name, partner, summary, cover, application window and events. So an operator should only have to say which program is featured.

## Domain story

1. Minh, an operator of GenAI Fund, opens Nestlé Vietnam AI Reinvention in Admin › Programs and chooses **Feature on home page** in the ⋯ menu.
2. The toast says the program is featured, with Undo. The program's screen and its row in the list carry a Featured badge.
3. Within a minute, a visitor opening the home page for the first time sees the announcement: the program's cover, its name, "Don't miss your chance to collaborate with Nestlé.", its summary, the deadline and its next event, and a button to the program's page. "Maybe later" puts it away to the corner, as now.
4. When applications to Nestlé close, the announcement goes by itself. Nobody has to stop featuring it.
5. Later Minh features the next program. The announcement shows it, and visitors who put Nestlé away see the new one once, because what they put away is kept per program.

Failure paths: no featured program is published and still taking applications (nothing shows on the home page); the program has no cover (the announcement shows without a photograph); the API cannot be reached while the home page renders (nothing shows; the page itself renders).

## How others do it

Studied in the clones under `.tmp/` on 14 October 2026.

| Reference            | How                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dub                  | `Program.featuredOnMarketplaceAt`, a timestamp: null is not featured. The public list filters on it; leaving the marketplace clears it                                   |
| Decidim              | `promoted` on a participatory process; the home page's `highlighted_processes` block shows the promoted ones                                                             |
| Saleor               | Moved from `product.is_featured` to one `SiteSettings.homepage_collection`                                                                                               |
| Indico, Decidim      | A free-text announcement: Indico's admin `enabled` and `message`, Decidim's `announcement` content block. Not tied to anything, so its words and dates are typed by hand |
| BeyondPilot, BEY-130 | `featured_at` on solutions, talent profiles and use cases, `POST …/feature` and `…/unfeature`, audit actions, the `FeaturedBadge` in Admin                               |

The announcement is about one program, so it is the second kind: a flag on the program, as Dub and Decidim do, built exactly as BEY-130 built it so operators find the same action and badge everywhere.

## Decisions proposed

| Decision                                                                                                                                                                | Why                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `program.featured_at`, a nullable timestamp, with `POST /api/program/admin/programs/{id}/feature` and `…/unfeature`, each `204`                                         | BEY-130's rules unchanged: featuring twice changes nothing and records nothing; `featured_at` is read-only on the entity and written by two `@Modifying` statements, so it does not touch `version` and never refuses an operator's save of the settings                                                       |
| Any program can be featured, and stays featured until an operator stops it                                                                                              | BEY-130's rule: no hidden state change. Unpublishing, or applications closing, does not clear it; it only keeps the program off the home page                                                                                                                                                                  |
| The announcement shows **the most recently featured** program that is published, takes applications here, and whose applications have not closed                        | Featuring the next program is enough; the previous one does not have to be stopped first. BEY-130 puts the earliest featured first in a list, but a list shows them all; the announcement shows one, and the operator's latest choice is the one meant. A closed program going by itself is what BEY-182 asked |
| Read through the public list: `GET /api/program/programs?featured=true`, the featured published programs, the most recently featured first                              | `GET /api/program/programs/featured` would take the address of a program whose slug is `featured`. The list already returns `ProgramSummary` with everything the announcement shows, and is already open without a session. The web picks the first whose applications have not closed                         |
| A reader is not told which programs are featured: `ProgramSummary` gains no field                                                                                       | BEY-130's decision of 11 October 2026 for the public cards. Operators see `featuredAt` on `AdminProgram` and in `AdminProgramList`                                                                                                                                                                             |
| The announcement's words: the eyebrow "Featured program", the name, "Don't miss your chance to collaborate with {partner}." when the program has a partner, the summary | The name, partner and summary are the program's. The lead line is the client's own wording with the partner put in; without a partner it is left out rather than invented                                                                                                                                      |
| The dates: the deadline (`applications.closesAt`), then the soonest event still to come (`upcomingEvents[0]`), its title and day                                        | Both are on `ProgramSummary`. Nestlé's "Early briefings · Apply before 5 Nov" is today a line of the catalog; it shows only once it is an event of the program, entered in Admin. **To approve:** this, or no second row at all                                                                                |
| The photograph is the program's cover; without a cover the announcement has none                                                                                        | BEY-182 already made Nestlé's cover the photograph of its building, uploaded in Admin. `building.webp` goes: nothing else uses it                                                                                                                                                                              |
| The ⋯ menu of the program's screen offers **Feature on home page** or **Stop featuring**; it runs at once, its toast offers Undo                                        | Where the menu already offers Copy link and Unpublish; a menu item needs no Save. Reversible, so no confirmation ([actions](../../../conventions.md#actions)), as `AdminUseCaseFeature` does                                                                                                                   |
| A Featured badge, "Featured since {day}", by the status on the program's screen, and in its row of the list                                                             | The shared `FeaturedBadge`, as on solutions, talent and use cases                                                                                                                                                                                                                                              |
| `program.feature` and `program.unfeature` in the audit log                                                                                                              | Every operator action of `program` is recorded; the same pair as the three directories                                                                                                                                                                                                                         |
| No `ProgramChanged` is published                                                                                                                                        | It re-indexes the program for search, whose content did not change (BEY-130's reasoning)                                                                                                                                                                                                                       |
| The migration features Nestlé Vietnam AI Reinvention by its slug                                                                                                        | The release replaces the constants, so without it the announcement would vanish from production until an operator features the program. Where no program has that slug, it updates nothing                                                                                                                     |
| The home page reads the featured program on the server, kept for a minute, and hands it to the announcement                                                             | As the programs page reads its list (`readPrograms`). The browser still decides at hydration whether the deadline has passed and whether the cookie notice is answered, as now. A failed read renders no announcement and does not fail the page                                                               |

## What changes

- **Backend, `program`.** The migration (`V94__program_add_featured_at.sql`, the number to be checked against `main` before merging): the column and the update for Nestlé. `Program.featuredAt`, read-only. `feature` and `unfeature` in `ProgramAdministration` and `AdminProgramsController`; `featured` on `ProgramListRequest` and its query in `ProgramQueryRepository`; `featuredAt` on `AdminProgramResponse` and `AdminProgramSummaryResponse`; `PROGRAM_FEATURE` and `PROGRAM_UNFEATURE` in `AuditAction`. `openapi.yml` and the generated web client.
- **Web, Admin.** The two menu items in `program-publishing.tsx`, the badge in `program-settings.tsx` and in `programs-admin-page.tsx`, the audit log's two actions, both catalogs.
- **Web, home page.** `featured-program.tsx` takes the program as a prop; the home page reads it. `featuredProgramSlug`, `featuredProgramDeadline` and the program's own words in `Home.featured` go; its labels stay.
- **Documents.** `docs/specs/program.md` (data, endpoints, audit), `docs/specs/audit.md`, `docs/tests/program.md`, the roadmap.

## Not done

- No order among several featured programs other than the latest featured, and no carousel: one announcement shows one program.
- No mark on the public programs list or on a program's page.
- The Tasco bar above the home page's header (`ChallengeBar`) and the Tasco lines of `llms.txt` stay written in the code. The bar goes by itself after 15 October; removing it and its constants is a cleanup of its own.
- No free-text announcement (Indico's kind) for something that is not a program. It waits until something asks for it.
