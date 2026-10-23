# Plan: An applicant changes who applies, and deletes a draft

The design is [design.md](design.md). Each step leaves the gates green.

| #   | Step                                                                                                                                                                                                 | State   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Backend, who applies: `OrganizationDirectory.standsAlone`; `becomeTeam`, a new `becomeIndividual` and `leaveApplicant` for an individual or a team that stands alone; `organize`, `leave` and `changeable` for a team; a team left so becomes a builder on their own; tests | Done    |
| 2   | Backend, delete a draft: `DELETE /api/proposal/applications/{id}`, its files when nothing else names them; `PROPOSAL_DRAFT_ONLY`; tests; `openapi.yml` and the generated client                         | Done    |
| 3   | Web: Change on a team in step 1; Delete draft on the application page; both catalogs; e2e                                                                                                           | Planned |
| 4   | `docs/specs/proposal.md`, `docs/specs/organization.md`, `docs/tests/*`; the gates; on staging: a team switched to a company and to oneself, a draft deleted                                            | Planned |
