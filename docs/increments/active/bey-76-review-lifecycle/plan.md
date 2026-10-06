# Plan: one review lifecycle

Design: [design.md](design.md). Tracked in [BEY-76](https://linear.app/beyondpilot/issue/BEY-76). One branch, `dathip04/bey-76-review-lifecycle`, one commit per step, one pull request.

Each step changes one module end to end: a forward-only migration that converts the stored values and replaces the check, the Java constants, transitions and error codes, the DTOs, `openapi.yml` and the generated client, the web badges, filters, actions and both message files, the e2e stubs, the tests and `docs/tests/<module>.md`.

| Step | What | Done when |
| --- | --- | --- |
| 1 | Research note, this increment, the review lifecycle in `docs/conventions.md` | Reviewed |
| 2 | `ReviewStatus` renders every review status and the taken-down state | `pnpm --dir web check` passes |
| 3 | Organization: `in_review`; send back; `suspended` becomes a takedown; decisions publish `OrganizationChanged`, and the index drops the solutions and use cases of an organization that is not approved or is taken down | `OrganizationTest`, `SearchDirectoriesTest` pass |
| 4 | Talent: `in_review`, `needs_changes`; `removed` becomes a takedown with restore | `TalentTest` passes |
| 5 | Solution: `in_review`; send back; reject only in review; take down and restore | `SolutionTest`, `SearchDirectoriesTest` pass |
| 6 | Use case: `published` becomes `approved` | `UseCaseServiceTest`, `UseCaseAdministrationTest`, `SearchTest` pass |
| 7 | Both gates, `main` merged in, CI green, staging checked: each operators' list, its filters and decisions | The pull request is merged |

The migrations take the next free versions when the branch takes in `main`.

## Next

- Keep an approved record public while its owner's change waits for review (design, decision 3), per module.
- The import of the old platform (BEY-74, BEY-75) writes organizations and active solutions as `in_review`, inactive solutions and use cases as `draft`.
