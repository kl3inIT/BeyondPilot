# ADR 0010: Matching reads the proposals a use case received

- Status: Accepted, implementation started 2026-10-20
- Date: 2026-10-20
- Decision owner: BeyondPilot team

## Context

The brief's §7.8 asks for a formal evaluation that compares "applicable solutions and received proposals against a use case". Matching ([ADR 0007](0007-a-matching-module-that-reads-through-search.md)) judges the solutions on BeyondPilot against a use case's requirements, with quotes code checks. The proposals a use case receives belong to `proposal` (BEY-133), which knows nothing of requirements or models. Neither module depended on the other: the web put "Proposal received" beside a candidate by reading both ([BEY-229](../increments/active/bey-229-proposal-evaluation/design.md)).

## Decision

- **`matching` depends on `proposal`.** It reads the proposals a use case holds now through `UseCaseProposals.sentTo`, a record per sent proposal with its approach, its team, its PDF and the solutions it offers, and hears `UseCaseProposalSent`, published when a proposal is sent or a sent one is edited.
- **A run judges the proposals** after the candidates, with the same requirements, instructions, quote check and limits, and keeps one evaluation per proposal in `matching_proposal`. A proposal sent or edited queues a run as an edit of the brief does.
- **`proposal` does not depend on `matching`.** The web reads the evaluations from matching and the proposals from `proposal`, and puts them together.

## Alternatives considered

- **`proposal` judges its own proposals**, depending on `ai`. It would copy the requirements, the prompts, the quote check, the worker, its limits and its refusals, and judge against a second list of requirements that could differ from the one Matched solutions shows.
- **`proposal` depends on `matching`** and asks it to judge. Matching would still need the proposal's text and PDF, which only `proposal` reads from storage: the call would go both ways.
- **A new module `evaluation`** depending on both. It would own one table and call into matching's internals for everything else, or move them out of matching.

## Consequences

- `matching` declares `proposal`; `ModulithArchitectureTest` holds the new edge, and `proposal` stays free of `matching`, so there is no cycle. `mcp` depends on both already.
- A change to what a proposal holds that the model should read changes `UseCaseProposals.sentTo` and the fingerprint matching keeps.
- The cost of judging proposals is a run's and is read on the runs page like any other.
