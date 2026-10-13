# Motion and small charts: what the app does, what the references do

Read on 13 October 2026, to decide how the web application moves and when a number gets a chart. The owner of the product asked what could make the admin home more than four counts, then why Dub's screens feel more alive than ours. This note records what the code holds, what the references do and what the sources say. The rules adopted from it are in [conventions › Motion](../conventions.md#motion) and [conventions › Charts](../conventions.md#charts); the first screen built on them is the admin home ([BEY-175](../increments/active/bey-175-admin-home/design.md)).

## What the code holds

Counted in `web/src` on 13 October 2026.

| Measure                                     | Ours                                                                      | Dub (`apps/web`, `packages/ui`)  | Medusa admin |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- | ------------ |
| Files that import a motion library          | 0 (`tw-animate-css` only)                                                 | 109 (`motion`)                   | 8 (`motion`) |
| Files with a number that counts             | 0                                                                         | 32 (`@number-flow/react`)        | 0            |
| Files with a container that animates height | 0                                                                         | 83 (`AnimatedSizeContainer`)     | 0            |
| Files with an animated entrance and exit    | The registry's dialogs, popovers and toasts                               | 50 (`AnimatePresence`)           | A few        |
| Charts                                      | One: `features/ai/usage-chart.tsx`, Recharts through the registry `chart` | visx, in its own `charts` folder | None         |
| A home dashboard                            | Four counts                                                               | Blocks of small charts           | None[^1]     |
| Distinct durations in classes               | 12, from 100ms to 2000ms                                                  | Named keyframes in one config    | Not counted  |
| `transition-all`                            | 10 files, all registry primitives in `components/ui`                      | Not counted                      | Not counted  |
| Reduced motion                              | Handled in 10 files                                                       | Through the library              | Not counted  |

[^1]: `packages/admin/dashboard/src/routes/home/home.tsx` redirects to `/orders`.

The base is sound: hover and focus have transitions, the registry's overlays open and close with one, lists have skeletons. What is missing is motion when content changes in place: a block that grows, a row that leaves, a tab that changes, a number that changes.

## What Dub does

Read in the clone under `.tmp/dub`.

- **One home for the values.** `packages/ui/src/motion-constants.tsx` names the list-item, stagger and tab-item transitions once; `packages/tailwind-config` names every keyframe with its duration and curve.
- **Motion wrapped in components.** A page does not write an animation; it uses a component that has one. `AnimatedSizeContainer` measures its content with a `ResizeObserver` and animates the frame to it, without animating the first measurement. `tab-select` slides one indicator between tabs with a shared `layoutId`. `modal` becomes a `vaul` drawer below the mobile breakpoint.
- **A stat tab with a mini chart.** `apps/web/ui/analytics/events/events-tabs.tsx`: a muted label, the number below it at 24px in `NumberFlow`, and `MiniAreaChart` at the right, at most 140px wide and hidden on a phone. The number fades while new data loads instead of being replaced by a skeleton.
- **`MiniAreaChart`** (`packages/ui/src/mini-area-chart.tsx`): a 1.5px line on a natural curve in a left-to-right gradient, the same area under it faded out downwards by a mask, a y scale from −2 to at least 2 so a flat series is not a line on the floor, no axis and no tooltip. It grows from zero when it mounts.

What does not transfer:

- **The taste.** List items arrive on a spring from 20px away, and the default gradient is violet to pink. Both suit a product that also sells itself; an operator's screen is opened all day.
- **The whole library on every page.** `motion` is 34kb for the full component. Our pages are Server Components by default, and most of what is missing can be done in CSS.
- **The natural curve on small counts.** Tried in a prototype on queues of 0 to 8 records: it overshoots, and a series of zeros and ones is drawn as a wave that dips below the real values. Recharts' `monotone` curve does not.

## What the sources say

| Source                                                                                           | What it says                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vercel, Web Interface Guidelines](https://vercel.com/design/guidelines)                         | Animate only when it clarifies cause and effect or adds deliberate delight. Prefer CSS, then the Web Animations API, then a JavaScript library. Animate `transform` and `opacity`. Never `transition: all`. Animations are cancelable by input. A spinner or skeleton has a show delay of about 150 to 300ms and a minimum visible time of 300 to 500ms |
| [Emil Kowalski, 7 practical animation tips](https://emilkowal.ski/ui/7-practical-animation-tips) | Keep UI animations under 300ms. `ease-out` for what enters or leaves; avoid `ease-in`. Never animate from `scale(0)`; start at 0.9 or above. Set the transform origin to the trigger. Remove the animation of an interaction repeated many times a day                                                                                                  |
| The `impeccable` skill, animate reference                                                        | In a tool, motion serves feedback, state and continuity. 100 to 150ms for immediate feedback, 150 to 300ms for a routine change of state, 300 to 500ms for a layout, overlay or view transition. Exit faster than entrance. Reduced motion means fewer and gentler animations, not none: drop the movement, keep the opacity                            |
| [Motion, accessibility](https://motion.dev/docs/react-accessibility)                             | `MotionConfig reducedMotion="user"` switches off transform and layout animations and keeps opacity and colour                                                                                                                                                                                                                                           |
| [Motion, bundle size](https://motion.dev/docs/react-reduce-bundle-size)                          | The full `motion` component is 34kb. `m` with `LazyMotion` is 4.6kb, plus 15kb for `domAnimation` (animations, exit, gestures) or 25kb for `domMax` (layout animations too)                                                                                                                                                                             |
| [NumberFlow](https://number-flow.barvian.me/)                                                    | No dependencies; respects the motion preference by default                                                                                                                                                                                                                                                                                              |
| [MDN, `interpolate-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size)     | Lets CSS transition a height to `auto`. Not Baseline; where it is missing the change is instant, nothing breaks                                                                                                                                                                                                                                         |
| Recharts 3.10.1, as installed (`node_modules/recharts/es6`)                                      | Animation is on by default (`isAnimationActive: 'auto'`): 400ms for bars, 1500ms for lines and areas, `ease`. It reads the motion preference (`usePrefersReducedMotion`)                                                                                                                                                                                |

Material Design 3's motion tokens and WCAG 2.2 (2.3.3 Animation from Interactions) were meant to be read; neither page could be fetched in the session, so nothing here is cited from them.

## What the numbers are, and are not

The sources give ranges, not values. Vercel gives no number at all: "choose easing based on what changes (size, distance, trigger)". A tooltip and a drawer half the screen tall cannot share one duration. A first draft of the rules fixed three durations, capped the admin area at 300ms and forbade springs; the owner asked where those came from, and they were the draft's own tightening of advice into law. The adopted rules keep a named scale so that pages do not invent values, leave the choice of step to judgement, and allow a spring that does not overshoot.

## Where a small chart earns its place

A sparkline shows direction and nothing else. It is worth its room when the direction changes what the reader does, and when the page holds no full chart of the same series.

| Screen                                     | Small chart | Why                                                                        |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Admin home, the review queues              | Yes         | Whether a queue grows or drains decides what an operator opens first       |
| Admin › Programs                           | Later       | Applications a day says whether a program needs a push before its deadline |
| Admin › Email › Activity                   | Later       | A bounce rate that rises is a real signal; it needs a series by day        |
| Admin › AI › Usage                         | No          | The full chart of calls sits under the totals                              |
| Admin lists (solutions, talent, accounts…) | No          | Tables to work in: the filters and the rows are what is needed             |
| Workspace and public pages                 | No          | The numbers there are a handful                                            |

The site went live in October 2026, so a series of 14 days is short and nearly flat today. The rules are written for the data the product will have.
