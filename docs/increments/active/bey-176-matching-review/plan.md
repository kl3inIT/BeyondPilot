# BEY-176 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-176. Steps 2 to 6 share one branch and one pull request, one commit per step.

| #   | Step                                                                                                                                                                                                                    | State                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | The issue, this design and plan                                                                                                                                                                                         | Done, 13 October 2026 |
| 2   | Backend: a removal without a reason; the reason given afterwards by its own action, on the removal, only by who removed; `MatchingRunTest`, `openapi.yml`, the generated client, the catalogs, `docs/tests/matching.md` | Done, 13 October 2026 |
| 3   | Web: `motion` 14.1.0; `DeckReader` split from its sheet; `matching-line.ts` with its test; the view with buttons, keys, the row with Undo and the reasons, behind a plain switch that starts on the list; no drag yet   | Done, 13 October 2026 |
| 4   | Web: the dragged card: head only, sideways, tilt, the stamp that turns solid, leaving along the gesture, Undo back from its side, reduced motion                                                                        | Open                  |
| 5   | Web: the switch and `?view=`, the first view, the run header above both views, the phone layout with the actions at the bottom, the next deck requested ahead                                                           | Open                  |
| 6   | An end-to-end test of the review; the conventions' line on Undo; the check on staging at desktop and at 390px                                                                                                           | Open                  |
| 7   | Count the published use cases that are still open and have no result on staging and production; report the number and the cost of a run from the recorded steps. Nothing is run                                         | Open                  |

## Verification

- `./gradlew :backend:check` and `pnpm --dir web check` in CI.
- `matching-review.test.ts`: the order of the line, Later, a candidate that arrives during a run, a candidate decided by someone else.
- Backend: a removal without a reason is kept and audited; the reason afterwards is written on the removal, by who removed only, and leaves who removed unchanged.
- On staging, as a signed-in operator, on a use case with results: shortlist by drag, by key and by button; remove, choose a reason, see it in the list; Later; Undo of each; a drag that starts on the deck leaves the card still; the deck turns to a requirement's page; a run started from this view adds cards at the end.
- At 390px: no sideways scroll, the actions within the screen, the deck's page scrolls.
- With reduced motion set: no tilt and no flight.
