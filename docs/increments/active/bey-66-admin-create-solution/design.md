# An operator creates and publishes a solution

Tracked in Linear as BEY-66, under BEY-34. Source: a request on 12 October 2026 that `/admin/solutions` lets an operator create a solution for an organization.

## The problem

Every write to a solution goes through `/api/solution/mine`, which asks for a member of the organization. An operator who has the facts of an organization's solution, for example from a call or a document, cannot enter them: the organization must sign in, write the solution and wait for the review of GenAI Fund. The review then reads what GenAI Fund itself wrote.

## What changes

1. **A button on `/admin/solutions`.** `Create solution` asks for an organization and a name, in a dialog like the organization's own. The organization is one that GenAI Fund approved; the list is the one the other admin screens already use.
2. **The same editor, on an admin page.** The draft opens at `/admin/solutions/[id]/edit` in the four steps of the organization's editor, with the same checks, the same autosave and the same preview. The page differs only where an operator differs from a member: where it saves, where it leaves to and what the last step does.
3. **Publish, not send for review.** The last step's action is `Publish`. It approves the solution at once, with no wait: the operator is GenAI Fund. What the editor asks before the action (what a review needs, the confirmation that the information is right) is asked the same way.
4. **The organization is told.** Its members receive the approval email they receive for any approved solution, and the solution appears in their list as approved.

## Decisions

- **One editor, a mode, not a second form.** The editor holds four steps, validation, autosave, uploads, a preview and a confirmation. A second form would drift from it. The editor takes the three calls it makes (read, save, send) from its page, and the admin page passes the operator's.
- **The operator's calls are under `/api/solution/admin/solutions`.** `/mine` stays what it is: the caller's own organization. `POST /admin/solutions` creates, `GET` and `PUT /admin/solutions/{id}/draft` read and save, `POST /admin/solutions/{id}/publish` publishes. Each asks for an operator, in `SolutionAdministration`.
- **The writing is `SolutionService`'s, not copied.** `SolutionService.save` moves its body to a package-private method that takes the organization's name instead of a membership; the member's save and the operator's save call it. The rules of a save (version, images, deck, what a submission keeps) stay in one place.
- **Only a draft is edited here.** What was sent for review, approved or refused is changed by the organization, or reviewed by the operator in the record. Editing an approved solution as an operator is not part of this increment.
- **Publish records both steps.** The solution records the operator as the account that submitted it, so the record names who sent it, and the audit trail records `solution.publish`, not a submission followed by an approval, because no one reviewed it.
- **The organization must be approved.** The directory lists a solution only when GenAI Fund approved its organization too, so creating for another is refused (`ORGANIZATION_NOT_APPROVED`).
- **Customer deployments are not in the operator's editor.** They are added by the organization, each waits for review, and the existing queue decides on them. The step shows no section for them.

## Not in this increment

- A list of the drafts an operator started. A draft belongs to its organization, so its members see it in their workspace; the operator reaches it from the page that created it.
- Changing a solution that was published. The record stays the review screen.
- Customer deployments entered by an operator.

## Known limits

- Members of the organization can open and edit an operator's draft in their workspace until it is published; the last save wins, by the version the editor already sends.
- An operator who leaves the editor before publishing returns only by the address of the draft.
