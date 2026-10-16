# A Just me is an ordinary organization — plan

Design: [design.md](design.md).

| #   | Step                                                                                                                                       | Done when                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `organization`: save and basics accept every type change with its guards; the public page, lookups and use cases are as before BEY-189     | `OrganizationTest` covers edit, switch to a team and back, `ORGANIZATION_NOT_ALONE` and `ORGANIZATION_TEAM_SIZE_REQUIRED` |
| 2   | `proposal`, `solution`: no renaming by the application; public solutions carry the organization's page again                               | `ProposalTest` and `UseCaseProposalTest` pass; `OpenApiContractTest` and the generated client agree                       |
| 3   | Web: menu, organization pages, form and popup type switch, wizard card and Review step actions, solution links, words                      | `organization-frame`, `organization-form` and `organization-schemas` tests; `workspace-organization` and `proposals` e2e  |
| 4   | `docs/specs/proposal.md`, `docs/tests/organization.md`, `docs/tests/proposal.md`, `ARCHITECTURE.md` and the roadmap say what the code does | the documents read the new behaviour                                                                                      |
