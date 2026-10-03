# Phase 1 plan

Milestones agreed with GenAI Fund on 2 October 2026:

- **Tuesday 6 October:** the main flows as UI/UX in Figma, for Kai's feedback.
- **Friday 9 October:** the website live with real listings (programs, solutions, use cases, talent) and a working application flow. Backend logic may follow, but the frontend must show everything.
- **Before 16 October:** the AI part (matching).

Each slice below is one vertical change: migration, module, API, `openapi.yml`, web, tests. A module is created by the first slice that needs it ([design](design.md#modules-owners-and-context-map)).

## Dependencies

| Needed for     | What                                                                                    | From                                        | Expected                            |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Slices 3, 4, 5 | Export of the v1 database and files; talent data                                        | Kai                                         | Monday 5 October                    |
| Slice 0        | A place to deploy. Agreed fallback: the team's own development environment; AWS later   | Team; Kai for AWS                           | Saturday 3 October for the fallback |
| Slice 1        | A Google OAuth client and an email sender                                               | Team (development); GenAI Fund (production) | Saturday 3 October for development  |
| Slice 7        | Whether web research is in the 16 October scope (BEY-23); automatic outreach is Phase 2 | Kai                                         | Before 12 October                   |

## Slices

| #   | Slice                             | Delivers                                                                                                                                              | Target        |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 0   | Deployable stack                  | Container images, Compose with PostgreSQL and MinIO, deploy to the development environment from `main` (BEY-16, part of BEY-18)                       | Sun 4 Oct     |
| 1   | `identity`                        | Sign in with Google and with an email link, return to the page of origin, JDBC sessions, CSRF header, 401 and 403 as problems, `/api/identity/me`     | Mon 5 Oct     |
| 2   | `program` read                    | Programs and events seeded from the blog and Luma dataset; program directory and program page, with the Insurance Challenge as the reference campaign | Tue 6 Oct     |
| 3   | `organization` and `catalog` read | v1 startups imported as organizations and solutions; solution directory with facets and solution page                                                 | Wed 7 Oct     |
| 4   | `usecase` read                    | v1 use cases imported; use case directory and page; programs feature their use cases                                                                  | Wed 7 Oct     |
| 5   | `talent` read                     | Talent directory and profile, if Kai's data arrives; otherwise the empty state                                                                        | Thu 8 Oct     |
| 6   | Apply                             | `document` upload, claim or create an organization, proposal draft, submit, confirmation, my proposals                                                | Thu 8 Oct     |
| —   | **Live**                          | Slices 0 to 6 on the development environment, shared with Kai                                                                                         | **Fri 9 Oct** |
| 7   | `matching`                        | Candidate board per use case from proposals and database matches, operator actions, hybrid search; web research after BEY-21                          | Wed 14 Oct    |
| 8   | Outcomes and migration report     | Outcome release and notification, migration reconciliation report                                                                                     | Thu 15 Oct    |

## Parallel work

- **Design:** Figma for slices 2 to 6 by Tuesday, following the UX research in Linear.
- **Backend:** slices 0, 1, then 2 to 6 behind the API contract.
- **Web:** pages against the generated client; the design system already exists.
- **Data:** the mapping in the [design](design.md#migration-from-v1), then the import and reconciliation once the export arrives.

## Risks

- **Data arrives late, or in another shape.** Slices 3 to 5 move, and the listings ship with the programs dataset only.
- **The Insurance Challenge switch.** Moving applications before 15 October risks drafts on Lovable; decided once the UI exists. Until then the challenge stays on Lovable.
- **Scope of the AI part:** slice 7 starts with database matching and operator sourcing; web research joins if BEY-23 confirms it, and outreach waits for Phase 2.
