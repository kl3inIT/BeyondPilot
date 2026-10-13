# BEY-176 — Matching: review the matched solutions one at a time

Status: proposed on 13 October 2026. The layout was reviewed by Đạt on a local HTML prototype with the staging data of one use case; the prototype shows the layout only, not the components.

## What it does

The matched solutions of a use case get a second way to be read, beside the list of [BEY-39](../bey-39-matching/design.md): one solution at a time, its deck on the left with the quoted words highlighted, the evidence per requirement on the right, and a decision under it. It answers Laura's feedback of 11 October: the list feels non-interactive, and she asked for the card deck of the old platform.

It adds no new kind of decision. A person shortlists or removes, as in the list, and both views show the same state.

## Domain story

1. A member of the use case's organization, or an operator, opens the matched solutions and chooses **One by one**.
2. The screen shows the first solution nobody has decided on, in the order of the list: strong fit, then experience in the industry, then the right technology.
3. The person reads the page of the deck that the AI quotes, turns its pages, and opens a requirement to read the vendor's words in full. A requirement whose words are in the deck turns the deck to their page.
4. The person decides: **Save** (shortlist), **Not a fit** (remove), or **Later**. The buttons use the words the list already uses for the same two decisions. The card leaves and the next one comes up.
5. After a removal the screen offers the five reasons. Choosing one is optional.
6. **Undo** takes back the last decision and brings its card back.
7. When no card is left, the screen says how many are on the shortlist and shows the list.

Failure and recovery:

- **A decision is refused or the connection fails:** the card comes back, and the screen says what happened in the words the list already uses.
- **Someone else decides on the card in front of the person:** the card stays until the person acts; a decision on a candidate that was removed meanwhile is refused and the card leaves with a sentence saying who removed it.
- **The deck cannot be opened:** the card shows the failure the deck reader already shows, with the link to the file. The evidence stays readable.
- **A solution has no deck:** the left side shows its profile text and the quote from its website.

## Who does what

Nothing changes in who may do what; this table restates BEY-39 for the new view.

| Action                        | Member of the use case's organization | Operator |
| ----------------------------- | ------------------------------------- | -------- |
| Read the cards                | Yes                                   | Yes      |
| Shortlist, remove, later      | Yes                                   | Yes      |
| Undo a removal                | What members removed                  | Any      |
| Add a solution by hand        | No                                    | Yes      |
| Start a run                   | Within the limits operators set       | Yes      |
| Steps, tokens, model of a run | No                                    | Yes      |

Decisions belong to the use case, not to the person: the organization and the operators see one shortlist. The provider of a solution is told nothing and sees nothing of it.

## What changes

### Backend

No migration: the column already allows an empty reason.

- `RemoveCandidateRequest.reason` becomes optional. A removal of a candidate already removed still changes nothing.
- A new action, `POST /api/matching/candidates/{id}/removal-reason`, says why after the removal. It writes the reason and the note on that removal row, so who removed the candidate, and who may restore it, do not change. Only the account that removed it may: anyone else is refused (403 `MATCHING_REMOVED_BY_SOMEONE_ELSE`), and a candidate no longer removed is refused (409 `MATCHING_CANDIDATE_NOT_REMOVED`), so a late reason never removes again what a colleague restored. It is audited as `matching.candidate_reason`.
- `openapi.yml`, the generated web client, the catalogs and `docs/tests/matching.md` change with it.

### Web

All in `web/src/features/matching/`.

| File                       | Holds                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `matching-line.ts` + test  | The line of cards as a pure function: who is in it, in what order, where a card sent to Later and a newly read card go |
| `matching-review.tsx`      | The view: the line, the keys, the three actions, the row that says what was decided with Undo and the reasons          |
| `matching-review-card.tsx` | The card that is dragged; the only file that uses `motion`                                                             |
| `matching-deck.tsx`        | `DeckReader` is split from its `Sheet` so that the same reader stands inside a card and inside the sheet               |
| `matching-panel.tsx`       | `FindingItem` is exported for the card; the panel keeps using it                                                       |
| `matching-board.tsx`       | The switch between One by one and List; the list itself is unchanged                                                   |
| `matching-search.ts`       | `?view=` in the address, beside `?solution=`                                                                           |

Reused as they are: `Button`, `Kbd`, `ToggleGroup`, `Empty`, `Spinner`, the status chip of `matching-marks.tsx`, the reason names of `matching-remove.tsx`, the deck pages and quote highlight of `matching-deck-pages.tsx`, and the run header of `matching-run.tsx`, which already says that matching never ran, that it is running, and that it found nothing. The new view stands under that header, so those three states need no new screen.

New dependency: `motion` 14.1.0. On 13 October 14.1.1 was hours old: the repository waits a day before installing a release (`minimumReleaseAge` in `web/pnpm-workspace.yaml`) and nothing called for an exception.

## The line of cards

- In it: every candidate the list shows (`isShown`) that nobody has decided on. A shortlisted or removed candidate is not in it; it is changed from the list.
- Order: the order of the list.
- **Later** moves the card behind every other card and records nothing. It is kept for the visit only: reading the page again puts the card back in its place.
- While a run goes on, a candidate it has just read joins the end, behind the cards sent to Later. The card in front never changes under the reader.
- The header counts what is left: "15 left of 17".

## The card

- Head: the grip, the logo, the name, country and maturity, and the group with how many requirements are met. Body: the deck reader on the left, the summary and the requirements on the right. Below 860px the body is one column, deck first.
- Only the head drags the card, and only sideways. The deck is turned, scrolled and selected like any deck, and the evidence scrolls; a drag that could start there would fight all three.
- Right is Save, left is Not a fit. There is no drag for Later: a vertical drag is the page's scroll on a phone.
- The same four things happen however the decision is given, by drag, key or button: the card leaves to its side, the next comes up, the row under the actions says what was decided, and Undo is offered.
- Keys: `→` shortlist, `←` remove, `↓` later, `Z` undo. They are ignored while the focus is in a field, in the deck's page, or a dialog is open. The list keeps its own `S` and `N`.
- The actions are buttons first; the drag is a second way to press them. On a phone the actions stay at the bottom of the screen however long the evidence is.
- The deck of the next card is requested while the current one is read, so that a card does not come up empty.

### Motion

`motion` gives the drag, the tilt, the settling back and the leaving, under [the motion rules](../../../conventions.md#motion), which were written on the same day:

- It is loaded as `LazyMotion` with `m` components. A drag needs the `domMax` features, not `domAnimation`; they come with the view, which the board imports with `next/dynamic` when One by one is first chosen, so neither is in the page's first load.
- A drag is the person's own movement, so the card follows it, and let go it leaves the way and at the speed it was going.
- A button moves the card a short way to its side as it fades, in less time than the next card takes to come up.
- A key moves nothing: the next card is there at once. A key is pressed many times in a row, and the rules give such an action no animation.
- Nothing bounces: the card settles back on a spring that does not pass its place.
- The tilt and the stamps read CSS custom properties that `motion` writes, since the lint allows no other inline style.

`react-tinder-card` was read on 13 October and is not used or adapted. It listens to mouse and touch events by hand and blocks every touch on the card, so nothing inside could scroll; it tilts by the speed of the hand, which shakes as the hand slows; it drags in four directions over the whole card; it has no keys and ignores reduced motion. Four of its ideas are kept:

1. Letting go decides when the card went far enough **or** fast enough: a short quick flick counts.
2. The card leaves along the direction and at the speed it was let go with, not on a fixed path.
3. The stamp on the card (SAVE, NOT A FIT) is faint while dragging and turns solid once letting go would decide.
4. Undo brings the card back from the side it left by, a short way.

With reduced motion set on the device, the card does not tilt or fly: it fades, and the next one appears.

## Decisions

| Decision                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two decisions and Later, not the old platform's Love, Save and Pass                                                                                                            | BeyondPilot already keeps shortlisted, removed and restored, shared by the organization and the operators. Love and Save lead to nothing different, and the brief names one thing, a shortlist. A third set of marks beside the decisions and the Yes/No on the AI's judgment would ask a person the same question three times                                                                                                                                                                                                          |
| A removal does not have to give a reason                                                                                                                                       | A form on every card stops the reading. The reasons are still wanted, for measuring the matching (BEY-114), so they are offered right after, one press each                                                                                                                                                                                                                                                                                                                                                                             |
| The reason given afterwards is written on the removal row, by its own action, and only by who removed                                                                          | The first version added a removal row, which made the removal belong to whoever gave the reason: an operator choosing a reason for a member's removal took from the member the right to restore it, the audit log read two removals, and a reason sent after a colleague's restore removed the candidate again. `matching_decision` stays append-only for decisions; a reason is not a decision, since it changes neither the state nor who decided. Shown to Đạt as `.tmp/matching-review/reason-flow.html` and accepted on 13 October |
| Undo stands in a row under the actions, not in a toast                                                                                                                         | [Actions](../../../conventions.md#actions) puts the Undo of a silent restorable action in the success toast. Here a person decides many times a minute: a toast per card would stack, and on a phone it would cover the actions. The rule is the same (the action runs at once, Undo calls the inverse); only its place differs, and the conventions say so once this lands                                                                                                                                                             |
| Undo goes back one decision at a time through this visit                                                                                                                       | It is what `Z` is expected to do; anything older is changed from the list                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The drag starts on the head only                                                                                                                                               | See [the card](#the-card)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `motion`, not `react-tinder-card`, `react-spring` with `use-gesture`, or `swiper`                                                                                              | One library, React 19, released weekly, MIT, and what Dub and Medusa use. `use-gesture` has had no release since March 2024; `swiper`'s cards effect is a carousel, not a decision                                                                                                                                                                                                                                                                                                                                                      |
| The card is not a shared component in `components/ui`                                                                                                                          | One screen uses it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| The view is in the address (`?view=`)                                                                                                                                          | A link to the review can be sent, and Back leaves it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Without `?view=`, a person meets One by one while something is undecided and they have not chosen the list before; the list otherwise. The same rule for members and operators | Decided by Đạt on 13 October. The choice is remembered in the browser, a convenience that may be lost; an operator who prefers the list chooses it once                                                                                                                                                                                                                                                                                                                                                                                 |

## Left out

- **Invite to propose** from the shortlist: BEY-105.
- **Runs for the imported use cases that have no result.** Decided by Đạt on 13 October: nothing is run for them now. The last step of the plan counts the published use cases whose closing date has not passed and that have no result, and reports the number with a cost estimate; if he then decides to run them, the runs are queued by a SQL file, as the import was loaded, not by a new endpoint.
- **A private mark per person.** The old platform's marks were each person's own; BeyondPilot's decisions are shared.
- **Comparing two solutions side by side:** BEY-113.

## Open

- Dragging a card that holds a real PDF reader is not proven: the prototype held a picture. If the drag by the head still disturbs the reader, the drag is dropped on the deck's side of the head, and Đạt is told before that changes.

## References read

- The old platform's one-by-one screen and "My Matches": [captures](../../../research/captures/old-platform/).
- `react-tinder-card` (3DJakob), `index.js` at `master`, read on 13 October 2026.
- `motion` (motiondivision/motion) 14.1.0: drag, `useDragControls`, `useTransform`, `AnimatePresence`, `useReducedMotion`.
- Dub and Medusa in `.tmp/`: both animate with `motion`.
