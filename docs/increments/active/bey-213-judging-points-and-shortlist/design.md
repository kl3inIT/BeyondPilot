# Proposals: a 1 to 10 scale with hidden weights, notes before scores, and the shortlist after the release

Status: revised on 16 October 2026 after Kai's review and built the same day; waiting to be checked on staging. A judge reads no weight: the criteria they receive carry none, and their own score is the mean of their scores. Tracked in Linear as BEY-213. It changes the review of [BEY-38](../../completed/bey-38-review/design.md).

GenAI Fund tested the judging of the AI for Insurance Challenge × Tasco on production. Minh and Kai shortlist the top 10 themselves, announce it, and the judges score those 10 live at the Demo Day on 22 October. They asked for:

- **A rubric with weights.** Tasco has 8 criteria worth 5 to 20 points, 100 in total, while every criterion was scored 1 to 5 the same way.
- **A scale judges read at a glance.** Kai: "just give them 1-10 and make it easy for them to see and know what does it mean for 1/5/10", and "remove all the other complicated stuff".
- **Notes before scores.** Kai: judges "might not do any scoring until they finish hearing all the pitches", so they bookmark an application and write brief notes first.
- **Judging after the release.** Today the release locks every score, so the judges could not score at the Demo Day.
- **Deciding without leaving the page.** Kai: "once shortlisted, it's ok to stay on the same page".
- **Judges with less access than GenAI Fund.** Kai, 17:05: judges "can only see the submissions from shortlisted solutions, read their information (but no access to their private information like contact details), score and make comment, save the solution".

## What people can do

- **An operator gives each criterion its weight in points** (1 to 100), or leaves every criterion without points. The criteria editor shows their total.
- **A judge scores each criterion from 1 to 10**, with the meaning of the scale on screen: 1–3 Weak, 4–6 Average, 7–8 Strong, 9–10 Outstanding. Judges never see the weights.
- **An application's score is the mean of the judges' totals.** When the criteria have points, a judge's total is the sum of `score / 10 × points`, out of the sum of the points. Without points, it is the mean of their scores, 1 to 10.
- **A judge or an operator bookmarks an application and keeps a private note at any time**, scored or not. Saving the scores still needs every criterion.
- **A judge reads only the shortlisted applications**, without the applicant's contact details (email, name, phone, LinkedIn). An application that is not shortlisted does not exist for them: the list leaves it out and its page, its files and its assessment answer 404. Their tabs are All, Bookmarked, To score and Scored. Until GenAI Fund shortlists, a judge's list is empty.
- **After the outcomes are released, the shortlisted applications are still scored.** The others stay locked, and every decision stays final.
- **An operator decides on an application's page and stays on it**: Shortlist and Not selected record the decision, and the page shows it.

## Decisions

1. **Scores are 1 to 10, and weights are the operator's.** Submittable Next's default scale is 1 to 10. Submittable Next, Award Force and Evalato weight each criterion, and Devpost for Teams weights a fixed scale ([research](../../../research/sources/2026-10-06-judging-platforms.md): pattern 3, and Weights under where they differ). A judge rates quality, and the platform applies the weights, so judges do not reckon with them. Ten levels separate ten finalists better than five. Their wider spread between judges is met by the meaning on screen, as COPILOT labels its scale.
2. **Weights are whole points from 1 to 100, every criterion or none.** A total out of a maximum means nothing when part of the criteria have no weight. Totals are shown to one decimal.
3. **One scale for every program.** No program has scores on production. Staging's test scores move from 1–5 to 1–10 by doubling, which keeps what they meant.
4. **A note and a bookmark need no score.** Submittable Next saves a review as a draft and Award Force saves every few seconds (research, their Scoring sections). An assessment holds what is saved: a note, a bookmark, the scores once every criterion has one, or a conflict. It counts as scored only with all its scores.
5. **The release closes the decisions and keeps the shortlist open to scoring.** Judging the shortlist after it is announced is the second round that Award Force and Submittable Next run as rounds. One rule does it here, without rounds, assignments or a winner status, which no program has asked for.
6. **Judges read the shortlist and nothing else.** Judges see only what they are assigned on every platform studied (research, pattern 1), and the shortlist is what GenAI Fund assigns. They read what an application says, not how to reach its applicant: contact details serve GenAI Fund's follow-up, not the judging. Not selected and the reasons stay operators' only.
7. **A decision on an application's page stays on the page.** Moving on after each decision suits screening every application in turn. GenAI Fund picks a few out of many and checks what it chose. The header's Next and the list's bulk decisions remain.

## Data

`V101` adds `review_criterion.max_points integer` (null or 1 to 100) and `proposal_assessment.bookmarked boolean`, and doubles the scores already saved.

## HTTP

| Change                                                                    | Use                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `SaveReviewCriterion.maxPoints`, `ReviewCriterion.maxPoints`              | A criterion's weight; a save refuses a mix of criteria with and without points         |
| `SaveAssessment.scores` 1 to 10, empty or complete; `bookmarked`          | Saves a note and a bookmark with or without scores; a partial set of scores is refused |
| `ReviewApplicationItem.mine`                                              | Also `noted` for an assessment kept without scores; `bookmarked` beside it             |
| `ReviewApplicationItem.shortlisted`, `ReviewApplication.shortlisted`      | Whether the application is shortlisted                                                 |
| Judges' list, application, file and assessment                            | Only shortlisted applications; another answers `PROPOSAL_APPLICATION_NOT_FOUND`        |
| `SubmittedApplication.email`, `.contact`                                  | Null for a judge                                                                       |
| `PUT /api/proposal/review/applications/{id}/assessment` after the release | Accepted for a shortlisted application; `PROPOSAL_RELEASED` for the others, as before  |

Every average (the list, the application page, the release and the spreadsheet export) is in points when the criteria have points.

## Web

- The criteria editor (`/admin/programs/[id]/reviewers`) takes a weight in points per criterion and shows the total.
- The assessment panel shows ten buttons per criterion, the meaning of the scale above them, a bookmark, and a note saved on its own. Scores save when every criterion has one. It stays editable after the release for a shortlisted application.
- The judges' tabs are All, Bookmarked, To score and Scored, over the shortlist. The submission's page shows a judge no contact rows.
- The decision panel's buttons are Shortlist and Not selected, and the page stays.
- Averages read as "62.5 / 100" when the criteria have points.
