# BEY-130 — Featured directory items

> **Completed, 14 October 2026:** delivered and running on staging and production (release 372f259b). What it left open is on its Linear issue.

Status: implemented and tested ([plan](plan.md)). The checks are in the test matrices of [solution](../../../tests/solution.md), [talent](../../../tests/talent.md) and [usecase](../../../tests/usecase.md); the six audit actions are in the [audit specification](../../../specs/audit.md). None of the three modules has a specification under `docs/specs/` yet, so the contract is stated here.

## Why

GenAI Fund asked that chosen records come first in the public directories: in AI solutions its technology partners and portfolio companies, in AI talent its portfolio founders and the product team. The lists sorted by name or by the most recently approved, and nothing could be put first. The owner then decided the name (featured, not pinned), where it applies (the opening view only), that a featured card says so, and that use cases get the same.

## Outcome

- **Data.** `solution.featured_at`, `talent_profile.featured_at` and `use_case.featured_at`, a nullable timestamp each (`V75__solution_add_featured_at.sql`, `V76__talent_add_featured_at.sql`, `V77__usecase_add_featured_at.sql`). Featured means the timestamp is set; nothing else is stored.
- **The operator's action.** `POST …/feature` and `POST …/unfeature` under `/api/solution/admin/solutions/{id}`, `/api/talent/admin/profiles/{id}` and `/api/usecase/admin/use-cases/{id}`, each `204`. In Admin the action is on the record's screen of all three, and in the row menu of the solutions and the use cases lists; the talent list has no row menu and gets none.
- **The public lists.** In the view a list opens with, the featured records come first, the earliest featured on top, then the newest. Everywhere else the list is ordered purely by what the reader chose. It is one query that pages the list, so featured records are on the first page only and the total is unchanged.
- **Showing it.** A reader sees only the order: no public card marks a featured record (decided on 11 October 2026: the directory should not tell readers which records the operators placed). Operators see a Featured badge (a star and the word, the registry `Badge`) in their lists and on the record, and their lists narrow by a Featured filter.
- **Audit.** `solution.feature`, `solution.unfeature`, `talent.feature`, `talent.unfeature`, `use_case.feature`, `use_case.unfeature`, recorded in the transaction of the change like the other operator actions of each module; the use case actions carry `organization` as the module's others do.

No module boundary changes. The three modules are built the same way and share no code; the web shares the `FeaturedBadge` composite.

## Decisions

### The opening view is: no search, no filter, the newest first

Featured records lead a list only when the request has no search text, none of the list's filters, and the order is `newest`, the order all three public pages open with (`directorySorts[0]` and the use case page's default).

- **Solutions:** no `q`, `industry`, `focusArea`, `maturity` or `organization`, and `sort=newest`. The page of an organization narrows by `organization`, so it is not the opening view and shows its solutions newest first with their badges.
- **Talent:** no `q`, `role`, `country`, `industry` or `engagement`, and `sort=newest`.
- **Use cases:** no `q`, `industry` or `program`, and `sort` absent or `newest`.

One wrinkle to know: the solutions and talent APIs fall back to `name` when `sort` is absent, while their pages open with `newest` and always send it. A request without `sort` is therefore ordered by name alone and is not the opening view. Changing the API's fallback order was not asked for and would change what other callers get.

The decision is taken in the application service (`SolutionDirectory`, `TalentDirectory`, `UseCaseDirectory`), which passes `featuredFirst` to the query repository; the repository only adds `featured_at asc nulls last` before the chosen order.

### The directories' search is the SQL list, and the site search does not know about featuring

Checked on 11 October 2026: each directory page sends its `q` to its own list endpoint, which matches with `LIKE` in the module's query repository; none of the three calls the `search` module. So a search in a directory is ordered purely by the reader's choice, by the rule above. The site search at `/search` (keyword and semantic, `SearchService`) is a separate page over `search_document`; `IndexedSolution`, `IndexedTalent` and `IndexedUseCase` do not carry `featured_at`, its ranking is unchanged and its result cards show no badge. Featuring therefore publishes no `SolutionChanged`, `TalentProfileChanged` or `UseCaseChanged`: that would re-index and re-embed a record whose indexed content did not change.

### A record that is not public can be featured, and stays featured

Any record the operators' list shows can be featured: a solution or a profile that was sent for review, whatever its status, listed or not, taken down or not; any use case, since operators see drafts of use cases too. Nothing but the operator's own press ends it: not a send back, a takedown, a restore, the owner hiding the record or editing it, or a new review.

Featuring has an effect only while the public list shows the record. A use case that is closed or not published, and a solution or profile that is not approved, is unlisted or is taken down, stays out of the list exactly as before: the public filter is untouched.

Why this rule: it is the only one with no hidden state change. Clearing it on a takedown would mean an operator who takes a partner's solution down for a day and restores it finds it silently no longer featured, and one who prepares the list before approving records could not. What Admin shows as featured is exactly what was featured.

### Featuring twice is not an error

`feature` on a featured record and `unfeature` on one that is not answer `204`, change nothing and record nothing in the audit log. The first time stays, so the order among the featured ones does not move when a second operator presses the same button.

### The order among featured records is the order they were featured in

The earliest featured is on top. There is no position to edit: to move a record down, stop featuring it and feature it again.

### Featuring does not touch the record's version

The owners' editors send the `version` they read and are refused when the record changed since. Featuring is not a change of theirs, so it must not refuse their save. `featured_at` is mapped read-only on each entity and written by two `@Modifying` statements of the module's repository (`update … set featured_at = :at where id = :id and featured_at is null`), which leave `version` and `updated_at` alone and make two simultaneous presses one. The same mapping keeps a save of the entity from ever writing the column.

### Where the fields are

The public summaries carry `featured`, a boolean: a reader needs to know that, not when. The operators' summaries and records carry `featuredAt`. `GET /api/solution/admin/solutions/{id}` answers the same `Solution` record the owners' editor reads, so `featuredAt` is on that record and an owner can read it through the API; the owners' screens do not show it, and the public card does anyway.

## Not done

- No badge on the public detail pages, in the site search's results or on the home page: the request was the cards of the lists.
- No limit on how many records are featured. More than a page of featured records continue on the second page of the opening view.
- No index on `featured_at`: the tables are read with the list's filter first and hold a few thousand rows.

## Not verified

- The Playwright specs and `knip` did not run on the development machine (out of memory); CI runs them.
- Nothing was looked at in a browser: the placement of the badge on the three cards and of the action on the use case record is written from the code, not seen.
