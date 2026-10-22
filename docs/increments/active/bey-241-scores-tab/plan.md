# Scores tab: plan

Design: [design.md](design.md). Tracked in Linear as [BEY-241](https://linear.app/beyondpilot/issue/BEY-241).

| #   | Step                                                                                                                  | State |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Research, this design and plan                                                                                        | Done  |
| 2   | Approval of the design (Đạt, 22 October)                                                                              | Done  |
| 3   | `proposal`: `GET …/scores` and `POST …/scores/export`, operator only, with the scorers, the means, counts and spreads | Done  |
| 4   | `openapi.yml` and the generated web client                                                                            | Done  |
| 5   | Web: the Scores tab, By application and By judge, the filter, sort and export                                         | Done  |
| 6   | Documents made true: `docs/specs/proposal.md`, `docs/specs/audit.md`, `docs/tests/proposal.md`                        | Done  |

One branch, one pull request, after BEY-239 is merged.

## Verification

- `./gradlew :backend:check`: against PostgreSQL, a program with three judges and an operator who scored, one conflict, one application not scored by a judge, criteria with and without points; the means match the Applications tab, the spread and its mark, a judge is refused, the export's lines and its record on the program.
- `pnpm --dir web check`, and a Playwright test: the tab lists the shortlist by mean, sorts by spread, switches to By judge, opens an application keeping the filter.
- On staging: the demo program `score-consolidation-demo`, then a screenshot to Đạt, Kai and Minh before production.
