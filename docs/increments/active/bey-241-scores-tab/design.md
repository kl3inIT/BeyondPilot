# Scores: a program's judging read side by side

Status: approved by Đạt on 22 October 2026; built. Revised the same day after the first screens on staging (decisions 8 to 10). Tracked in Linear as [BEY-241](https://linear.app/beyondpilot/issue/BEY-241). What was read before this design is in [Judging consolidation](../../../research/2026-10-22-judging-consolidation.md).

## Why

At the Tasco deliberation on 22 October, Kai asked how to see every judge's scores, and Minh proposed a consolidation view. Today an operator reads the judges' average and the number of scores of each application in Applications, and each judge's scores only by opening one application at a time; the export holds the count and the average, not who gave what. A deliberation compares applications across judges and starts from where judges disagree, which no screen shows.

## What an operator does

1. Minh opens Admin › Programs › AI for Insurance Challenge × Tasco › **Scores**. The shortlisted applications are listed, the highest mean first. Each judge is a column holding their mean over the criteria; the last columns hold the mean across judges, how many scored it and the spread between the highest and lowest judge.
2. RiskRadar's spread reads 3.6 with a mark: one judge gave 9.0, another 5.4. Minh sorts by spread to put such applications first, and the panel discusses them.
3. Minh opens RiskRadar from its row: the application page, unchanged, lists each judge's scores by criterion and their notes, and is where an operator scores.
4. Kai switches to **By judge**: each judge with how many applications they scored and stepped back from, and their mean. One judge's mean is 5.8 where the others are near 7.5; the panel keeps that in mind.
5. Minh downloads the scores: one line per judge and application, every criterion's score, the note and whether it was a conflict.

## What the tab shows

| Part                     | Holds                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| By application (default) | A row per shortlisted application the search keeps: its solution and organization, the mean across scorers, the spread and how many scored it, kept in view; then a column per scorer with their mean on that application, Conflict, or a dash when they have not scored it. Sorted by the mean by default, by any column on its header |
| By judge                 | A row per scorer: name and role (judge or GenAI Fund), applications scored, stepped back from, still to score among the shortlist, and their mean over the applications they scored                                                                                                                                                     |
| Filter                   | The search of Applications by solution or organization; only the shortlist is listed (decision 8)                                                                                                                                                                                                                                       |
| Export                   | CSV or Excel, of the applications the filter keeps: one line per scorer and application, with each criterion's score, the scorer's mean, the note, conflict, the version scored and when                                                                                                                                                |

## Decisions

1. **Read only.** Scoring stays on the application page, which already reads every judge's scores by criterion. The tab only compares. Every row opens its application, keeping the tab's filter so Previous and Next follow it (BEY-238).
2. **A scorer is anyone whose assessment counts.** Joined judges, with or without a score yet, and operators who scored, as Reviewers lists them; an operator invited as a judge is one judge (BEY-239). A note or a bookmark alone is not a score and shows a dash.
3. **The cell is the scorer's mean over the criteria**, on the scale the Applications tab uses: 1 to 10, or points when the criteria carry points. The mean across scorers is the one Applications shows, so the two tabs never disagree.
4. **Spread is the highest minus the lowest scorer's mean**, with two or more scores. It is marked at 2 points on the 1 to 10 scale, a fifth of the most points when the criteria carry points. A standard deviation over two or three judges says less and reads worse.
5. **No normalization.** With two to five judges a judge's own spread rests on a handful of scores; By judge shows each judge's mean instead, so a strict judge is visible without rescaling anyone's scores.
6. **One endpoint for the tab and one for its export.** `GET /api/proposal/review/programs/{programId}/scores` returns the scorers and a row per submitted application with each scorer's mean or conflict, the mean, the count and the spread; the web filters, sorts and switches views as Applications does. `POST …/scores/export?format=` takes the applications the filter keeps, as the applications export does, and is recorded on the program. Operator only.
7. **No schema change.** Everything is read from `proposal_assessment`, the criteria and the judges the program has.
8. **Only the shortlist.** Judges score only the shortlisted applications (BEY-213): at Tasco on 22 October all 45 scores were on the 10 shortlisted of 49 submitted. The decision tabs and the Decision column of the first version therefore showed empty columns, and are gone; the search stays. An operator who scored no shortlisted application gets no column. Đạt, 22 October.
9. **The numbers to deliberate on lead.** The application, the average, the spread and the count come first and stay in view while the scorers' columns scroll under them, so that ten scorers (Tasco at its fullest: nine judges invited and GenAI Fund) read as well as three. On a phone only the application stays. The other products read keep the ranking table to the mean and the count and show who gave what elsewhere; the matrix keeps both, with the ranking first. `DataTableView` gained `pin` for this.
10. **Who pulls an application up or down.** On a row whose spread is marked, the highest and the lowest scorer's cells are tinted, with words for a screen reader.

## Built where

- **Backend, `proposal`:** `ReviewService.scores` and `exportScores`, built on the existing `average`, `score` and `points`; `ProgramScoresResponse` in `dto`; two operations on `ReviewController`; `openapi.yml` and the generated web client.
- **Web, `features/review`:** `program-scores-page.tsx` on the registry `DataTable` with the toolbar of Applications, `scores-search.ts` for `?view=&tab=&q=&sort=`; the route `admin/programs/[id]/scores`; the tab in `ProgramTabs` between Applications and Evaluations; words in both catalogs.

## Out of scope

Scoring in the tab, normalization, a consensus score that overrides the mean, weighted criteria, the tab for judges (a judge never reads another judge's scores).
