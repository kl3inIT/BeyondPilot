# Criteria worth points, and judging the shortlist: plan

Design: [design.md](design.md). Tracked in Linear as BEY-213. Needed on production before the Tasco Demo Day on 22 October 2026.

| #   | Step                                                                                                                                                    | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | This design and plan                                                                                                                                    | Done  |
| 2   | Backend: `V101`, the maximum on save and read, averages in points, `shortlisted` for judges, scoring the shortlist after the release, the export        | Done  |
| 3   | `openapi.yml` and the web client refreshed                                                                                                              | Done  |
| 4   | Web: the maximum in the criteria editor; the points, labels and total in the assessment panel; the Shortlisted tab first for judges; averages in points | Done  |
| 5   | Documents made true: `docs/tests/proposal.md`, BEY-38's design noted as changed by this one                                                             | Done  |

Each step is one or more commits, pushed as it is finished, on one branch with one pull request.

## Verification

- `./gradlew :backend:check`, the review tests speaking HTTP against PostgreSQL:
  - criteria are saved with maximums, and refused with a mix of criteria with and without points, a maximum that is not a multiple of 5, or one above 100;
  - an application's average is the mean of the judges' totals in points, and stays the 1 to 5 mean for a program without points;
  - after the release, a judge saves an assessment of a shortlisted application and is refused one of a not selected application; a decision is still refused;
  - a judge reads `shortlisted` and no other part of the decision.
- `pnpm --dir web check`, with a component test of the assessment panel showing the points of each level and the total.
- On staging: Tasco's criteria re-entered with their maximums, a judge scoring on a phone width, then a release and a score of a shortlisted application.

## Needed from outside the code

| What                                                             | For                          | Where it is managed    |
| ---------------------------------------------------------------- | ---------------------------- | ---------------------- |
| The maximum of "Operational sustainability" (5, if 100 in total) | Re-entering Tasco's criteria | Asked of Minh, BEY-213 |
| A production deployment before 22 October                        | Judging at the Demo Day      | The user names it      |
