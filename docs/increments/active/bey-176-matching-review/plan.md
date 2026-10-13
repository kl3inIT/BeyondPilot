# BEY-176 — plan

Design: [design.md](design.md). Tracked in Linear as BEY-176. Steps 2 to 6 share one branch and one pull request, one commit per step.

| #   | Step                                                                                                                                                                                                          | State                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | The issue, this design and plan                                                                                                                                                                               | Done, 13 October 2026 |
| 2   | Backend: a removal without a reason; a reason given to one's removal afterwards; the member's refusal on an operator's removal; `MatchingTest`, `openapi.yml`, the generated client, `docs/tests/matching.md` | Done, 13 October 2026 |
| 3   | Web: `motion` installed; `DeckReader` split from its sheet; `matching-review.ts` with its test; the view with buttons, keys, the row with Undo and the reasons; no drag yet                                   | Open                  |
| 4   | Web: the dragged card: head only, sideways, tilt, the stamp that turns solid, leaving along the gesture, Undo back from its side, reduced motion                                                              | Open                  |
| 5   | Web: the switch and `?view=`, the first view, the run header above both views, the phone layout with the actions at the bottom, the next deck requested ahead                                                 | Open                  |
| 6   | An end-to-end test of the review; the conventions' line on Undo; the check on staging at desktop and at 390px                                                                                                 | Open                  |
| 7   | Count the published use cases that are still open and have no result on staging and production; report the number and the cost of a run from the recorded steps. Nothing is run                               | Open                  |

## Verification

- `./gradlew :backend:check` and `pnpm --dir web check` in CI.
- `matching-review.test.ts`: the order of the line, Later, a candidate that arrives during a run, a candidate decided by someone else.
- Backend: a removal without a reason is kept and audited; a reason afterwards adds a row and leaves the state removed; a member's reason on an operator's removal is refused.
- On staging, as a signed-in operator, on a use case with results: shortlist by drag, by key and by button; remove, choose a reason, see it in the list; Later; Undo of each; a drag that starts on the deck leaves the card still; the deck turns to a requirement's page; a run started from this view adds cards at the end.
- At 390px: no sideways scroll, the actions within the screen, the deck's page scrolls.
- With reduced motion set: no tilt and no flight.
