# Admin home: plan

Design: [design.md](design.md). Tracked in Linear as BEY-175; the convention it builds on is BEY-174.

One branch and one pull request for the convention and slice 1. Each step is one commit or a few small ones, pushed as it is finished, in this order.

| #   | Step                                                                                                                                                                                                 | State   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | The research note and the Motion and Charts sections of the conventions (BEY-174)                                                                                                                    | Done    |
| 2   | The design and this plan                                                                                                                                                                             | Done    |
| 3   | **The shared pieces.** The duration tokens and `chartDrawMs`; `StatStrip` and `StatCell`; `ChartFrame`; Admin › AI › Usage moved onto them, its chart drawing in `chartDrawMs`                       | Planned |
| 4   | **The home, slice 1.** `features/admin-home`: the five queues, the applications by program, the system block. Messages in English and Vietnamese. The end-to-end test of the home brought in line    | Planned |
| 5   | Merged when CI is green; checked on staging at desktop and phone widths, light and dark                                                                                                              | Planned |
| 6   | **Slice 2**, after the owner decides who adds the read to solution, talent and use case: the `queue` read in each module, `openapi.yml` and the web client, the cells' "oldest" line and small chart | Waiting |
| 7   | `verification.md`; the increment moved to `completed`                                                                                                                                                | Planned |

## Verification

- `pnpm --dir web check`.
- The end-to-end test of the admin home: the five queues with their counts and addresses, the applications block, the system block, at desktop and phone widths, with axe.
- The end-to-end tests of Admin › AI › Usage still pass after its totals and its chart move to the shared components.
- On staging: the home against the lists it summarises (each count equals the total of its list), the AI figures against Admin › AI › Usage on "7 days", the email figures against Admin › Email › Activity on "Last 7 days".
- Slice 2: `./gradlew :backend:check`, with tests per module that only operators read the queue, that a record waits from its sending to its decision, and that the series has one entry for each of the 14 days in `Asia/Ho_Chi_Minh`.

## Needed from outside the code

The owner's decision on who adds the `queue` read to the solution, talent and use-case modules.
