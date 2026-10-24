# Use cases: private and public, approved once

## Accepted scope

A use case is private until GenAI Fund has approved it once. After that its organization or GenAI Fund can make it private and public again as often as they like, and edit it, with no further review. Kai's review of 24 October 2026 accepted this life cycle; the reviewed Figma flow is `Screens` → `Use case — the full flow, in order (draft for review)`.

The full flow has three parts. This increment is the first; the other two follow as their own increments.

1. **Private and public (this increment).** The status `private`, the two switches, edits that take effect at once, the wizard's last step (Save as private, Request to publish) and the admin Visibility card.
2. **Member access.** Per use case, Viewer, Editor and Full access, set by the creator, the organization's Owner and GenAI Fund; the Share dialog and the Member access tabs.
3. **Preview link.** An address that shows a private use case read only to anyone, switched on and off by a person with Full access.

## Status and visibility

| Status          | Who sees it                                    | How it ends                                                                           |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `draft`         | The organization's members and GenAI Fund      | `in_review` when a member sends it (Request to publish); `approved` by an operator    |
| `in_review`     | The same                                       | `approved` or `needs_changes` by GenAI Fund; back to `draft` when the members pull it |
| `needs_changes` | The same                                       | `in_review` when the members change it and send it again                              |
| `approved`      | Everyone: directory, search, detail, proposals | `private`; `closed` once the close date has passed                                    |
| `private`       | The organization's members and GenAI Fund      | `approved` by a member or an operator, with no review; `closed` after the close date  |
| `closed`        | Derived from the close date, never stored      | Nothing: it is locked                                                                 |

People read `draft` and `private` as one word, Private. They differ only in what a switch to public needs: a `draft` was never approved, so it is reviewed; a `private` use case was, so it is not.

## Decisions

- **A new status, not a flag.** `private` is a value of `status`, as in every other lifecycle of the repository. Everything that selects public use cases already filters on `approved`, so a private use case leaves the directory, search, matching, the program pages and the proposal forms without a change to any of them. The proposals a private use case received stay saved; `UseCaseDirectory.target` returns nothing for it, so nobody sends a new one.
- **Edits are live.** `UseCaseService.save` no longer moves an approved use case back to a draft. Because the edit is live, the save is refused with `USECASE_INCOMPLETE` when it would take away a part GenAI Fund approved. A save keeps `private` as it is.
- **Switches.** `POST /api/usecase/mine/{id}/make-private` and `make-public` for the members; `POST /api/usecase/admin/use-cases/{id}/make-private` and `make-public` for operators. Making public fails with `USECASE_CANNOT_MAKE_PUBLIC` unless the use case is private and open (for operators also a `draft` or `needs_changes` one that holds what a public use case needs). Both are audited as `use_case.make_private` and `use_case.make_public` (`use_case.publish` when an operator publishes a never approved one). Nobody is emailed.
- **Pulling back is for review only.** `POST /mine/{id}/draft` now takes a use case out of review; a public one is made private instead. `USECASE_CANNOT_MOVE_TO_DRAFT` says so.
- **Who may switch.** Every member of the organization, as every member may already edit and send a use case. Per-use-case access arrives with the second increment and narrows this.
- **The earlier private draft stays.** BEY-232's `operators_only` draft, which MCP writes and members do not see, is a separate mechanism and is untouched; it is reconciled with member access in the second increment.
- **The proposal count is not shown to visitors.** The public brief no longer says how many proposals a use case received. The organization and GenAI Fund still read the count.

## Interface

Wizard: the last step is Review and finish. Save as private keeps the use case private and is on every step; Request to publish sends it for the one review. Once a use case was approved the last step only saves. A banner says that changes are live.

Organization list: the statuses read Public, Private, In review, Needs changes and Closed. A public row offers Make private (with a confirmation that says proposals stay saved); a private row offers Make public.

Admin: the list and the use case page read Public and Private. The record has a Visibility card with Make private, Make public or Publish; each runs at once and its toast offers Undo. The create form has Save as private beside Publish.
