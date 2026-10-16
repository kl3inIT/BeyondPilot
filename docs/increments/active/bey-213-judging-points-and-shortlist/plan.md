# A 1 to 10 scale with hidden weights, notes before scores, and the shortlist after the release: plan

Design: [design.md](design.md). Tracked in Linear as BEY-213. Needed on production before the Tasco Demo Day on 22 October 2026.

The first build gave each level its points on the button. Kai's review asked for a plain 1 to 10 scale, notes before scores and decisions that stay on the page. Steps 2 to 4 rework that build on the same branch before anything is pushed.

| #   | Step                                                                                                                                                          | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | This design and plan, revised after Kai's review                                                                                                              | Done  |
| 2   | Backend: `V101` reworked (weights 1 to 100, bookmark, scores doubled); scores 1 to 10; a note and a bookmark without scores; `noted`; totals with the weights | Done  |
| 3   | `openapi.yml` and the web client refreshed                                                                                                                    | Done  |
| 4   | Web: ten buttons and the scale's meaning; note and bookmark saved alone; Bookmarked tab; weights in the criteria editor; decisions that stay on the page      | Done  |
| 5   | Documents made true: `docs/tests/proposal.md`, the end-to-end judging spec                                                                                    | Done  |

Each step is one or more commits on one branch with one pull request.

## Verification

- `./gradlew :backend:check`, the review tests speaking HTTP against PostgreSQL:
  - criteria are saved with weights, and refused with a mix of criteria with and without points;
  - a score outside 1 to 10 or a partial set is refused; a note and a bookmark are saved without scores and the application stays to score;
  - an application's average is the mean of the judges' weighted totals, and the mean of the scores without weights;
  - after the release, a judge scores a shortlisted application and is refused one of a not selected application; a decision is still refused;
  - a judge reads `shortlisted` and no other part of the decision.
- `pnpm --dir web check`, with component tests of the assessment panel (ten buttons, the meaning, a note saved alone) and the decision panel staying on the page.
- On staging: Tasco's criteria re-entered with their weights, a judge bookmarking and noting on a phone width, then scoring; a release and a score of a shortlisted application.

## Needed from outside the code

| What                                                            | For                                | Where it is managed    |
| --------------------------------------------------------------- | ---------------------------------- | ---------------------- |
| The weight of "Operational sustainability" (5, if 100 in total) | Re-entering Tasco's criteria       | Asked of Minh, BEY-213 |
| What else Kai finds complicated on the judge's screen           | Keeping the judge's screen minimal | Asked of Kai, BEY-213  |
| A production deployment before 22 October                       | Judging at the Demo Day            | The user names it      |
