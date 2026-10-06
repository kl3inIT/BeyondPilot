# AI talent: a project credited by the organization that delivered it — plan

Design: [design.md](design.md). Tracked in Linear as BEY-67.

| #   | Step                                                                                                                                  | State                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Figma: the project editor (describe or link), the credit states, Project credits for owners with its dialogs, the profile and the team | In progress                   |
| 2   | Agreement on the screens and decisions with the product owner                                                                         | Waiting                       |
| 3   | Migration `V18__talent_project_credits.sql`; projects saved by id                                                                     | Not started                   |
| 4   | `solution`: `ApprovedDeployment`, the two reads on `SolutionDirectory`, `q` on the deployment list; `talent → solution` in `ModulithArchitectureTest` | Not started |
| 5   | `TalentService`: link, request, confirm, decline, remove, the limits, the emails, the audit actions; the team read                    | Not started                   |
| 6   | `openapi.yml`, the generated web client, `TalentTest`, `docs/tests/talent.md`; `./gradlew :backend:check`                              | Not started                   |
| 7   | Web: the editor, Project credits, the profile, the card and the team on the solution and company pages; both catalogs                 | Not started                   |
| 8   | End-to-end tests; `pnpm --dir web check`                                                                                              | Not started                   |
| 9   | `ARCHITECTURE.md`, BEY-36 decision 12 marked as replaced for linked projects                                                          | Not started                   |

Steps 3–5 can ship without the team on the solution pages; the profile alone already shows the proof.

## Verification so far

None yet: the increment is at the design step.
