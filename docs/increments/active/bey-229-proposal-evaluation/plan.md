# Formal evaluation of received proposals: plan

Design: [design.md](design.md). Tracked in Linear as BEY-229.

| #   | Step                                                                                                                                                                   | State   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | This design and plan, and ADR 0010                                                                                                                                      | Done    |
| 2   | `proposal`: `UseCaseProposalSent` on send and on an edit of a sent proposal; `UseCaseProposals.sentTo` with each proposal's text, PDF and solutions                     | Done    |
| 3   | `matching`: `V105`; a run judges the proposals after the candidates; a proposal sent or edited queues a run; `GET /api/matching/use-cases/{id}/proposals`               | Done    |
| 4   | `openapi.yml` and the web client refreshed                                                                                                                             | Done    |
| 5   | Web: List and Compare on the received proposals page, the card on a proposal's page, for the organization and for operators                                           | Done    |
| 6   | Documents made true: `docs/specs/matching.md`, `docs/specs/proposal.md`, `ARCHITECTURE.md`, `docs/tests/matching.md`, `docs/tests/proposal.md`                         | Done    |

Each step is one or more commits on one branch with one pull request.

## Verification

- `./gradlew :backend:check`:
  - sending a proposal publishes `UseCaseProposalSent`, and so does an edit of a sent one; a draft's save does not;
  - a run judges a sent proposal against the use case's requirements, reads its PDF and the material of the solutions it offers, lowers a quote that is in none of them, and asks nothing for a proposal that did not change;
  - an edited proposal reads as `outdated` until a run judges it again; a withdrawn one is not answered;
  - the vendor's member, and anyone outside the use case's organization, is told there is no such use case;
  - `ModulithArchitectureTest` with the new edge.
- `pnpm --dir web check`, with tests of how a proposal's source label is named.
- On staging: a proposal sent to a use case with a model chosen, read on the Compare view and on its page, as a member and as an operator, at phone width too.
