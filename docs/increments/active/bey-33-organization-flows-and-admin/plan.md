# Organization, the flows completed and what operators manage: plan

Design: [design.md](design.md). Tracked in Linear under BEY-33: slice 1 is BEY-61, slice 2 is BEY-62, slice 3 is BEY-63. Each slice lands as its own pull request, with both gates green.

## Slice 1: domains, invitations, answers (BEY-61)

| #   | Step                                                                                                                                                                             | State |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `V10__organization_verify_domains_and_limit_invitations.sql`                                                                                                                     | Done  |
| 2   | `OrganizationService`: no domain from the creator, a claim always reviewed, the declined answer, invitation limits, auto-join only on a verified domain; the two decision emails | Done  |
| 3   | `OrganizationAdministration`: approve with a domain, the claim decision with a domain, the list's request, asker and date, the suggested domain                                  | Done  |
| 4   | `OrganizationTest` for steps 2 and 3; `./gradlew :backend:check`; `openapi.yml` and the web client                                                                               | Done  |
| 5   | Web: pastel tokens, `Status` as a pill, role and avatar tints                                                                                                                    | Done  |
| 6   | Web: the entry states, the Members page with the allowance and the limit dialogs, "Who can join"                                                                                 | Done  |
| 7   | Web: the operators' list with Asked by, the review dialog with the domain, the claim dialog                                                                                      | Done  |
| 8   | Web: "Clear search and filter" in one update; the three admin specs without the reload; admin home counts customer deployments                                                   | Part  |
| 9   | Both message catalogs; end-to-end tests for the new states; `pnpm --dir web check`; each flow walked in the browser                                                              | Done  |
| 10  | `docs/tests/organization.md`; the first increment's design where this one replaces it                                                                                            | Done  |
| 10a | `V11`: the founded year and the logo; the profile form requires the website, the description (280), the year and asks the logo; "Submit for approval"                            | Done  |

Step 8 is in part: the admin home now counts a claim as an organization that waits. The way back from an empty list still races the toolbar's delayed write of the address, once in forty runs of `admin-organizations.spec.ts` without its reload, so the reload stays in the seven list specs; the cause is in `FilterToolbar`, which every list shares. The admin home does not count customer deployments: `solution` has no count of them across solutions.

## Slice 2: take down, operator edits, members (BEY-62)

| #   | Step                                                                                                                                   | State |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 11  | `V12`: the `suspended` status with its reason; `OrganizationAdministration` takes down and restores; public reads hide a suspended one | Open  |
| 12  | Operator edits the profile and the verified domain, with the version check                                                             | Open  |
| 13  | Operator changes a role, removes a member, invites and revokes; audit actions                                                          | Open  |
| 14  | Web: the record page with Profile and Members tabs, the take-down and restore dialogs, the members table and its dialogs               | Open  |
| 15  | Web: the workspace of a taken-down organization, the leave dialog, the last owner; the public address of a taken-down organization     | Open  |
| 16  | Tests, gates, catalogs, the verification matrix                                                                                        | Open  |

## Slice 3: merge (BEY-63)

| #   | Step                                                                                                          | State |
| --- | ------------------------------------------------------------------------------------------------------------- | ----- |
| 17  | `V13`: the `merged` status and `merged_into_id`; the merge in one transaction; `OrganizationMerged`           | Open  |
| 18  | `solution` moves its solutions on `OrganizationMerged`; the public address answers with the kept organization | Open  |
| 19  | Web: the merge dialog, the merged record, the Merged filter, the notice to a moved member, the redirect       | Open  |
| 20  | Tests, gates, catalogs, the verification matrix; move both organization increments to `completed`             | Open  |
