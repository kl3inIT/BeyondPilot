# An organization's solutions in its admin record

An operator who reads an organization in the admin area sees what it has sent for review and decides on it there. Tracked in Linear as BEY-34.

## Outcome

- **A Solutions tab on the organization's record.** `/admin/organizations/[id]/solutions` lists every solution the organization has sent for review, those that wait first, and says how many solutions and customer deployments wait. One solution is open beside the list with its record, its customer deployments and the decision; `?solution=` names it, and without it the first of the list is open.
- **A decision without leaving the organization.** Approving, sending back and taking down a solution, and deciding on a customer deployment, work in the tab as they do on the solution's own record, with the same keys. A decision on a solution that waits opens the next one of this organization that waits.
- **A way in from the solution.** In the operators' list of solutions, and in the decision panel of a solution's record, the organization's name leads to this tab at that solution.

## Decisions

1. **Tabs are routes.** The record keeps `/admin/organizations/[id]` as its Profile; the tab is a route beside it, as the tabs of My organization are. Only a provider has solutions, so any other organization shows no tabs, and its Solutions address answers 404.
2. **The list is the operators' list, narrowed.** `GET /api/solution/admin/solutions` takes `organization`, the identifier of one organization, and every row carries `organizationId` beside the name. No second list was written.
3. **The open solution is built from what the record already uses.** `SolutionRecord`, `CustomerDeploymentsReview` and `SolutionReview` are the same components as on `/admin/solutions/[id]`, which stays the full record and is one link away.
4. **The design was reviewed as an HTML prototype.** The assignee walked through the three screens (the list, a solution's record, the organization with its tabs) in a clickable prototype on 6 October 2026 and accepted it. No Figma frame exists yet.

## Known limits

- The tab shows the first 25 solutions of an organization and has no search or status filter.
- The introductions asked about a solution and the history of a record, both in the prototype, are left out: the operators' list of introductions narrows by a solution's name only, and the audit log does not narrow by what an event is about.
- The Profile is unchanged. The prototype redraws it (what the organization says about itself, what it has here, its review with a timeline, its verified domain) and gives operators the actions to edit it, take it down and manage its members. Those change the page that BEY-61 is changing and need capabilities of the organization module that do not exist yet.
- No end-to-end test opens the tab yet; the stub backend already narrows the list by organization.
