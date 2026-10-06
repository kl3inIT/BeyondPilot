# The solution editor in four steps, with a deck that is a file: plan

Design: [design.md](design.md). Tracked in Linear as BEY-34.

| #   | Step                                                                                                                                                     | State |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | The states the frames lacked, in Figma: fields to add, no deck yet, deck uploading, deck refused, draft not saved, review with fields to add             | Done  |
| 2   | `V18` and `V19`; the purpose `solution_deck`; the new fields on `Solution`, its request and its responses                                                | Done  |
| 3   | `solution → storage`: attaching, replacing and removing a deck in `SolutionService`, `ReplacedDecks`, and the deck's address in `SolutionDirectory`      | Done  |
| 4   | `SolutionTest` and the matrix in `docs/tests/solution.md`; `openapi.yml` and the generated web client                                                    | Done  |
| 5   | Web: the editor in steps with its saves, the deck upload, the review step; the new fields on the public page and in the operators' review; both catalogs | Done  |
| 6   | Unit tests of the editor's state; end-to-end tests of the steps, the saves, the deck and the review                                                      | Done  |
| 7   | `ARCHITECTURE.md` and the known limits of the increments this one makes untrue                                                                           | Done  |

## Verification

- `./gradlew :backend:check` passes: `SolutionTest` covers the new fields, the deck's attach, replace, removal and refusals, and who reads a deck before and after approval.
- `pnpm --dir web check` passes, with `solution-editor-state.test.ts`.
- `pnpm --dir web test:e2e` passes on desktop and mobile Chrome, with axe on each step, the review with fields to add and the Evidence step.
- The editor was walked against the real backend at 1440 and 390 pixels: the four steps, a change saved by itself and the state it reports.
