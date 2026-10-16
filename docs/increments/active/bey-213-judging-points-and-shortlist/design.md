# Proposals: criteria worth points, and judging the shortlist after the release

Status: built on 16 October 2026, waiting to be checked on staging. Tracked in Linear as BEY-213. It changes the review of [BEY-38](../../completed/bey-38-review/design.md).

GenAI Fund tested the judging of the AI for Insurance Challenge × Tasco on production and asked for two things. First, its rubric gives each criterion its own weight (8 criteria worth 5 to 20 points, 100 in total), while every criterion is scored 1 to 5 the same way. Second, Minh and Kai shortlist the top 10 themselves, announce it, and the judges score those 10 live at the Demo Day on 22 October. Today the release locks every score, so the judges could not score at all.

## What people can do

- **An operator gives each criterion its maximum points** (5, 10, 15, 20 …), or leaves every criterion without points as today. The criteria editor shows the total of the maximums.
- **A judge scores a criterion that is worth points with the same five buttons, each showing the points it gives**: 4, 8, 12, 16 and 20 on a 20-point criterion. Each level is named Poor, Fair, Good, Very good or Excellent, in the button's accessible name and under the criterion once chosen. The panel shows the running total out of the maximum.
- **An application's score is the mean of the judges' totals**, in points out of the program's maximum, when its criteria are worth points; it is the mean of the judges' means, 1 to 5, when they are not.
- **A judge sees which applications are shortlisted**, in a Shortlisted tab that comes first in their tabs.
- **After the outcomes are released, judges and operators keep scoring the shortlisted applications.** The not selected stay locked, and every decision stays final. A judge's To score tab and their next application then count only the shortlisted.

## Decisions

1. **Points are a maximum per criterion; the judge still picks one of five levels.** Award Force, Submittable Next and Evalato give each criterion its own maximum, and Devpost for Teams weights a 1 to 5 scale ([research](../../../research/sources/2026-10-06-judging-platforms.md), pattern 3). GenAI Fund ruled out typing and sliders, and the 1 to 5 scale alone left judges guessing the weight. Five buttons that show the points keep the judging quick and alike between judges, and work on a phone during a live pitch. A level is worth `level × max / 5` points. Award Force's dropdown of every integer up to the maximum is the next step if a program needs finer points.
2. **A maximum is a multiple of 5, from 5 to 100**, so every level is a whole number of points. Tasco's rubric is in multiples of 5.
3. **Either every criterion of a program is worth points or none is.** A total out of a maximum means nothing when part of the criteria have none. A program without points keeps BEY-38's 1 to 5 mean, so the programs already reviewed do not change.
4. **The stored score stays the level, 1 to 5.** Points are derived from the level and the maximum. No assessment is rewritten, and the maximum is part of the criteria, which lock when the first assessment is saved (BEY-38).
5. **A release closes the decisions and keeps the shortlist open to scoring.** The applicant's outcome and the email of the release do not change, and scores never reach applicants. Judging the shortlist after it is announced is the second round that Award Force and Submittable Next run as rounds. One rule does it here without rounds, assignments or a winner status, which no program has asked for. Operators read the shortlist ordered by score and choose from it.
6. **Judges see the shortlisted status and nothing else of the decisions.** The shortlist is what GenAI Fund wants judges to focus on. Not selected and the reasons stay operators' only.

## Data

`V101` adds `review_criterion.max_points integer`, null or a multiple of 5 from 5 to 100. Assessments are unchanged.

## HTTP

| Change                                                                    | Use                                                                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SaveReviewCriterion.maxPoints`, `ReviewCriterion.maxPoints`              | A criterion's maximum; a save refuses a mix of criteria with and without points, or a bad value |
| `ReviewApplicationItem.shortlisted`, `ReviewApplication.shortlisted`      | Whether the application is shortlisted, for judges as for operators                             |
| `PUT /api/proposal/review/applications/{id}/assessment` after the release | Accepted for a shortlisted application; `PROPOSAL_RELEASED` for the others, as before           |

Every average (the list, the application page, the release and the spreadsheet export) is in points when the criteria are worth points. The web adds up the maximums from the criteria the head already carries, so no total is sent.

## Web

- The criteria editor (`/admin/programs/[id]/reviewers`) takes a maximum per criterion and shows the total.
- The assessment panel shows the points on each button with the level in its accessible name, the level chosen under the criterion, and the total out of the maximum. It stays editable after the release for a shortlisted application.
- The judges' tabs are Shortlisted, All, To score and Scored. The list keeps opening on All: Shortlisted leads the row with its count, and an address of its own (`?tab=shortlisted`) can be sent to judges.
- Averages read as "62.5 / 100" when the criteria are worth points.
