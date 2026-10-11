# BEY-130 — Pinned directory items

Status: implemented and tested ([plan](plan.md)). The checks are in the test matrices of [solution](../../../tests/solution.md) and [talent](../../../tests/talent.md); the four audit actions are in the [audit specification](../../../specs/audit.md). Neither module has a specification under `docs/specs/` yet, so the contract is stated here.

## Why

GenAI Fund asked that chosen records come first in the two public directories: in AI solutions its technology partners and portfolio companies, in AI talent its portfolio founders and the product team. Both lists sorted by name or by the most recently approved, and nothing could be put first.

## Outcome

- **Data.** `solution.pinned_at` and `talent_profile.pinned_at`, a nullable timestamp each (`V74__solution_add_pinned_at.sql`, `V75__talent_add_pinned_at.sql`). Pinned means the timestamp is set; nothing else is stored.
- **The operator's action.** `POST /api/solution/admin/solutions/{id}/pin` and `/unpin`, `POST /api/talent/admin/profiles/{id}/pin` and `/unpin`, each `204`. In Admin the action is on the record's screen of both, and in the row menu of the solutions list; the talent list has no row menu and gets none.
- **The public lists.** `order by pinned_at asc nulls last`, then the order the reader chose, in the one query that pages the list. So the pinned records that match the search and the filters come first, the earliest pinned on top, under both orders; they are on the first page only, the total is unchanged, and a filter that leaves a pinned record out leaves it out.
- **Showing it.** The operators' lists and the record screens show a pin icon with the word Pinned, and both lists narrow by a Pinned filter. The public cards show nothing: they have no slot for such a mark, and the order is the feature.
- **Audit.** `solution.pin`, `solution.unpin`, `talent.pin`, `talent.unpin`, recorded in the transaction of the change like the other operator actions of the two modules.

No module boundary changes. The two modules are built the same way and share no code.

## Decisions

### A record that is not public can be pinned, and keeps its pin

Any record the operators' list shows can be pinned: everything that was sent for review, whatever its status, listed or not, taken down or not. A draft cannot, because the operators' area never shows one. A pin is never cleared by anything but Unpin: not by a send back, a takedown, a restore, the owner hiding the record, or a new review.

The pin has an effect only while the directory shows the record. A record pinned while it waits for review comes first from the moment it is approved; one taken down leaves the directory and is back in its place when restored.

Why this rule: it is the only one with no hidden state change. The alternative, allowing a pin only on a public record and clearing it on a takedown, means an operator who takes a partner's solution down for a day and restores it finds it silently unpinned, and one who prepares the list before approving records cannot. With the rule chosen, what Admin shows as pinned is exactly what was pinned, and the operator's last press is always what holds.

### Pinning twice is not an error

`pin` on a pinned record and `unpin` on one that is not pinned answer `204`, change nothing and record nothing in the audit log. The first pin's time stays, so the order among the pinned ones does not move when a second operator presses the same button. A typed refusal would add two error codes for a state the operator already wanted.

### The order among pinned records is the order they were pinned in

The earliest pinned is on top. There is no position to edit: to move a record down, unpin it and pin it again. Drag-and-drop ordering was not asked for and would need a second column.

### A pin does not touch the record's version

The owners' editor sends the `version` it read and is refused when the record changed since. A pin is not a change the owners can see, so it must not refuse their save. `pinned_at` is therefore mapped read-only on the entity and written by two `@Modifying` statements of the module's repository (`update … set pinned_at = :at where id = :id and pinned_at is null`), which leave `version` and `updated_at` alone and make two simultaneous pins one. The same mapping is what keeps the owner's own save from ever writing the column.

### `SolutionChanged` and `TalentProfileChanged` are not published

Search does not read the pin: `IndexedSolution` and `IndexedTalent` do not carry it, and the ranking of the site search is out of scope. Publishing the event would re-index and re-embed a record whose indexed content did not change.

### `pinnedAt` on the solution record

`GET /api/solution/admin/solutions/{id}` answers the same `Solution` record the owners' editor reads, so `pinnedAt` is on that record and an owner can read it through the API; the owners' screens do not show it. It is not a secret, since the public order shows it. For talent the operators' record already wraps the profile (`AdminTalent`), so `pinnedAt` sits on the wrapper and the person's own profile does not carry it.

## Not done

- No mark on the public cards.
- No limit on how many records are pinned. More than twelve pinned records fill the first page and continue on the second; the operators' Pinned filter shows how many there are.
- No index on `pinned_at`: both tables are read with the directory's filter first and hold a few thousand rows.
