# Admin home: plan

Design: [design.md](design.md). Tracked in Linear as BEY-175; the convention it builds on is BEY-174.

One branch and one pull request for the convention and both slices. Each step is one commit or a few small ones, pushed as it is finished, in this order.

| #   | Step                                                                                                                                                                                                   | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | The research note and the Motion and Charts sections of the conventions (BEY-174)                                                                                                                      | Done  |
| 2   | The design and this plan                                                                                                                                                                               | Done  |
| 3   | **The shared pieces.** The duration tokens and `chartDrawMs`; `StatStrip` and `StatCell`; `ChartFrame`; Admin › AI › Usage moved onto them, its chart drawing in `chartDrawMs`                         | Done  |
| 4   | **The home, slice 1.** `features/admin-home`: the five queues, the applications by program, the system block. Messages in English and Vietnamese. The end-to-end test of the home brought in line      | Done  |
| 5   | Merged when CI is green; checked on staging at desktop and phone widths, light and dark                                                                                                                | Done  |
| 6   | **Slice 2**, Đạt deciding on 13 October that this increment adds the read to every module: the `queue` read in each module, `openapi.yml` and the web client, the cells' "oldest" line and small chart | Done  |
| 7   | `verification.md`; the increment moved to `completed`                                                                                                                                                  | Done  |

## Verification

- `pnpm --dir web check`.
- The end-to-end test of the admin home: the five queues with their counts and addresses, the applications block, the system block, at desktop and phone widths, with axe.
- The end-to-end tests of Admin › AI › Usage still pass after its totals and its chart move to the shared components.
- On staging: the home against the lists it summarises (each count equals the total of its list), the AI figures against Admin › AI › Usage on "7 days", the email figures against Admin › Email › Activity on "Last 7 days".
- Slice 2: `./gradlew :backend:check`, with tests per module that only operators read the queue, that a record waits from its sending to its decision, and that the series has one entry for each of the 14 days in `Asia/Ho_Chi_Minh`.

## Found on the way

The end-to-end test of the admin account menu failed on a phone once the home grew longer than the screen: it reached the Language and Appearance submenus with the mouse, whose path crossed the other submenu's trigger and the sidebar's links while the page settled. The same test on main fails 7 times in 8 when pointed at Admin › AI › Usage, a long page. The menu works; the test now opens both submenus from the keyboard.

## Needed from outside the code

Nothing.
