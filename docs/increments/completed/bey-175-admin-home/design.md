# Admin home: every queue, the applications to judge and the state of the system

Status: done on 13 October 2026, live on staging ([plan](plan.md), [verification](verification.md)). Tracked in Linear as BEY-175. It changes one screen and adds shared web components; the second slice adds one read-only endpoint to each module that owns a review queue. No new module and no new dependency between modules, so there is no boundary discovery.

The layout is the prototype Đạt approved on 13 October (`.tmp/admin-home.html`, not committed), less the two blocks it marked as needing larger reads, and corrected below where the code on `main` differs from what the prototype assumed. The rules it is built on are [conventions › Motion](../../../conventions.md#motion) and [Charts](../../../conventions.md#charts) (BEY-174), from the [research note](../../../research/2026-10-13-motion-and-charts.md).

## What it does

The admin home shows four counts: organizations, solutions, talent profiles and customer deployments waiting for review. An operator who opens it learns nothing else: not that use cases wait too, not how long the oldest record has waited, not whether a queue grows, not that the reader of documents has been failing for an hour.

After this change the home answers three questions, top to bottom.

| Block                | Question                                  | What an operator sees                                                                                      |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Waiting for a review | What needs a decision from GenAI Fund?    | One strip of five queues. Slice 2 adds how long the oldest has waited and the queue's last 14 days         |
| Applications         | Which programs have applications to read? | Each program with submitted applications: how many, how many the operator has assessed, when it closes     |
| System               | Is anything broken?                       | The AI calls of the last 7 days with the share that failed, the email of the last 7 days, the search index |

## Domain story

1. An operator opens Admin. The line under the title says five records wait for a decision.
2. The strip shows 2 use cases, 3 solutions and nothing else waiting. A queue with nothing in it reads quieter. They open the solutions, already narrowed to those in review.
3. Back on the home, the applications block shows the Nestlé program with 37 applications, 12 of them assessed by this operator, closing in 12 days. They open it to go on judging.
4. The system block shows 1,284 AI calls in 7 days, 2.3% failed, with the failed calls stacked in red on Thursday. Email: 412 sent, 3 bounced. The search index holds 2 records back. Each block leads to its page.

Failure and recovery:

- **Nothing waits:** the line says so and every queue reads quiet; the strip stays, because it is also the way to each list.
- **No program has an application:** the block says so in one line. It is not hidden, so the page keeps its shape.
- **No AI call or no email in the period:** the block shows zero and a line that says so; no empty chart is drawn.
- **A read fails:** the page fails as a whole into the admin area's `error.tsx`, as today. The home reads operator-only endpoints of healthy modules; a block that silently went missing would read as "nothing waiting".

## Glossary

| Term     | Meaning                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue    | The records of one kind whose review status is `in_review` ([review lifecycle](../../../conventions.md#review-lifecycle)); for an organization, a request that waits |
| Waiting  | How many records a queue holds now                                                                                                                                   |
| Oldest   | When the record that has waited longest was sent (slice 2)                                                                                                           |
| Assessed | An application the operator scored or stepped back from, as the review screens count it                                                                              |
| Period   | The last 7 days with today for AI and email, the last 14 days with today for a queue's history, in `Asia/Ho_Chi_Minh`                                                |

## Slice 1: what the web can show today

No endpoint changes. Every figure comes from a read an admin screen already makes.

| Figure                           | Read                                                                     | Note                                                        |
| -------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Organizations, solutions, talent | The admin lists narrowed to `in_review`, their `total`                   | As today                                                    |
| Customer deployments             | `deploymentsAwaitingReview` of the solutions list                        | As today                                                    |
| Use cases                        | `inReview` of the admin use-case list                                    | New on the home                                             |
| Applications by program          | `readReviewPrograms`: `applications`, `assessed`, `closesAt`, `released` | An operator gets every program with a submitted application |
| AI calls                         | `readUsageOverview` for `7d`: `totals` and `series`                      | The series is drawn as the page's one chart                 |
| Email                            | `readEmailActivity` for `week`: `counts`                                 | Only the counts of the answer are used                      |
| Search index                     | `readSearchIndex`: `kinds` (`listed`, `waiting`, `heldBack`)             | Summed over the kinds                                       |

Corrections to the prototype:

- **Five queues, not six.** The prototype had "Introductions overdue". The request for an introduction to a solution's provider was removed on 13 October (BEY-172), and its admin list with it.
- **The programs block counts what exists.** The prototype drew "applications received" against an invented maximum. The admin program list holds the application window, not a count. The review programs read holds the count and how many the operator assessed, so the bar is assessed of submitted: a bar that means something. A program whose outcomes are released is left out.
- **The queue cells have no small chart and no "oldest" line yet.** Neither can be read today for every queue; they arrive together in slice 2, so the strip never shows a trend for some queues and not for others.

## Slice 2: a queue's history

Each module that owns a queue answers one read, for operators only. Đạt decided on 13 October that this increment adds it to every module, those of other owners included.

`GET …/queue` answers `{ waiting, oldestSince, from, days }`: how many wait now, when the one that has waited longest was sent, the first of the days, and how many waited at the end of each of the 14 days from `from` to today in `Asia/Ho_Chi_Minh`, today last and equal to `waiting`.

| Module         | Address                                       | A record waits from … until …                                                                                   |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `organization` | `/api/organization/admin/organizations/queue` | A new organization from its creation until `decided_at`; a claim to own one from the request until its decision |
| `solution`     | `/api/solution/admin/solutions/queue`         | `submitted_at` until `decided_at`                                                                               |
| `solution`     | `/api/solution/admin/deployments/queue`       | The deployment's creation until `decided_at`, or until it is withdrawn                                          |
| `talent`       | `/api/talent/admin/profiles/queue`            | `submitted_at` until `decided_at`                                                                               |
| `usecase`      | `/api/usecase/admin/use-cases/queue`          | `submitted_at` until `reviewed_at`, while it has not closed                                                     |

It is computed when read, from what the row keeps: a record counts as waiting on a day when it was sent before that day ended and was still waiting, or decided only after, at its end. A row keeps only its last sending and its last decision, so a record sent back and sent again loses its first wait, and an organization sent back counts from its creation: the history is exact for today and an approximation behind it, good for a direction and not for an audit. An organization waiting both as new and on a claim counts once. No snapshot table and no scheduler: the alternative, a count written every night, would be exact but would show nothing for its first 14 days and adds a job to every module. No migration was needed: every table already keeps the two moments.

Each queue cell then shows "The oldest has waited n days" and the queue's `Sparkline` from 768px, drawn in grey when nothing waited in the 14 days.

## How slice 1 is built

- **Tokens** in `web/src/app/globals.css`: `--transition-duration-fast` (100ms), `-base` (200ms) and `-slow` (300ms), which give the classes `duration-fast`, `duration-base` and `duration-slow`. `src/lib/motion.ts` holds `chartDrawMs` (400), the one duration a library takes as a number.
- **`StatStrip` and `StatCell`** in `components/composites/stat-cell.tsx`: a `dl` whose cells share hairlines, each a label, a number, one line under it and room at its side. A cell with an address is a link; a cell whose number is zero can read quiet. The totals of Admin › AI › Usage are this pattern written by hand (`Total` in `features/ai/usage-page.tsx`) and move to it.
- **`ChartFrame`** in `components/composites/chart-frame.tsx`: a `figure` with its title, one line under it, an action at the right and the chart. The chart of Admin › AI › Usage moves into it; the home's AI block is the second.
- **`UsageChart`** gains a `compact` size for the home: lower, without the value axis and the legend, which the frame's line replaces. Both sizes draw in `chartDrawMs`.
- **The page** stays a thin Server Component: the role check, the reads in one `Promise.all`, then `AdminHomePage` in a new `features/admin-home/`, which imports the reads of the domains it summarises as the page does today.

## Screen

The page head is `AdminPageHeader` with the destination, the title and one line: how many records wait.

1. **Waiting for a review.** One strip of five cells: use cases, solutions, talent profiles, organizations, customer deployments. Two a row on a phone, three from 768px with the last two filling the second row, five from 1280px. Each cell is a link to its list, narrowed to what waits.
2. **Applications.** A list, one program a row: its name and the number of applications, a bar of assessed against submitted with "You assessed 12 of 37", and when it closes or that it has closed. A row opens the program's applications to judge.
3. **System.** The AI block, two thirds wide from 1024px: "AI calls, last 7 days", the count and the share that failed, the way to Usage, and the calls by day as stacked bars. Beside it, a strip of two cells: email (sent, with delivered and bounced under it) and the search index (records listed, with what waits and what is held back under it).

Motion: the cells change colour on hover in `duration-fast`; the chart draws in `chartDrawMs`, and not at all for a person who asked for less motion. Nothing else on the page moves: it is opened many times a day.

## Decisions

| Decision                                                          | Why                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| One strip with hairlines, not a card a queue                      | Five bordered cards on a white page read as five unrelated things. Dub's stat tabs and our own usage totals are one band       |
| The label above the number                                        | The reader learns what it is before how many, as in Dub's stat tab and in the usage totals                                     |
| Two slices                                                        | The first needs no endpoint and could ship alone; the second adds five endpoints in four modules, three of them other people's |
| No trend on some queues before all have one                       | A strip where two cells have a chart and three do not reads as broken                                                          |
| History computed from the rows, not a nightly count               | See [slice 2](#slice-2-a-queues-history)                                                                                       |
| Recharts' `monotone` for the small chart, not Dub's natural curve | Tried in the prototype on queues of 0 to 8: the natural curve overshoots and draws values the data does not have               |
| No counting numbers on the home                                   | The numbers change only when the page is loaded again, so the animation would never be seen                                    |
| "Submitted and decided by week" and "records by status" left out  | Each needs a larger read than slice 2's, and the site is days old: both would draw almost nothing                              |
| The whole page fails when one read fails                          | See the failure list above                                                                                                     |

## Left out

- A row that slides out on a decision, a sliding tab mark and a number that counts: named in the research, each its own change.
- Small charts on Admin › Programs and Admin › Email: later, when there is a series to draw.
- A live view. The home shows what is true when it is opened or reloaded.

## References read

- Dub (`.tmp/dub`): `apps/web/ui/analytics/events/events-tabs.tsx`, `packages/ui/src/mini-area-chart.tsx`, `apps/web/ui/partners/overview`.
- Medusa admin: `packages/admin/dashboard/src/routes/home/home.tsx`, which has no dashboard.
- This repository: the admin home, `features/ai/usage-page.tsx` and `usage-chart.tsx`, the admin lists and their queries, the review programs read.
