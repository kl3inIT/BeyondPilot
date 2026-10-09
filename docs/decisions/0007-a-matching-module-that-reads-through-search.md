# ADR 0007: A `matching` module that finds candidates through `search` and judges them with a model

- Status: Accepted, implementation started 2026-10-09
- Date: 2026-10-09
- Decision owner: BeyondPilot team

## Context

The brief asks BeyondPilot to recommend, for a use case, the solutions already on it that fit, in GenAI Fund's three groups (§7.8). The old platform returned a score nobody could check and let nobody add or remove a match.

A probe on two real use cases on 9 October 2026 ([research](../research/2026-10-09-matching-references-and-probe.md)) showed that the best candidates are often found only by what their deck or website says, that a strong model quotes those texts word for word, and that one provider's limit is reached within a single run.

The domain story, glossary, data owners and context map are in the [BEY-39 design](../increments/active/bey-39-matching/design.md), as [boundary discovery](../conventions.md#boundary-discovery) asks.

## Decision

- **A module `matching` owns the requirements of a use case, its runs and its candidates.** It depends on `ai`, `search`, `solution` and `usecase`; nothing depends on it.
- **The text of decks, websites and customer cases is kept by `search`** as passages, beside the index, because it is searched and embedded with it. `matching` reads it through `SolutionEvidence` and writes none of it.
- **The model only proposes.** It answers per requirement with a quote and its source. Code checks each quote against the text, lowers a finding whose quote is not there, and decides the group. Nothing the model says is shown without that check.
- **A run is a row that a worker takes**, not a request that waits: it survives a restart and a provider's limit, and it is the same whether an approval, an operator or a recovery started it.
- **One task and one model** for every call of a run, chosen by operators in Admin › AI.
- **Three read-only methods are added to modules other people own**: `UseCaseDirectory.brief`, `SolutionDirectory.deck` and `customerCases`, as Đạt decided on 9 October.

## Alternatives considered

- **Put matching in `search`.** The index is a projection with no rules of its own; runs, judgments and people's decisions are a different thing to own and to change.
- **Let the model rank or score.** A score cannot be checked, and the probe's reasons were only trustworthy because each stood on a quote.
- **Spring AI's `Evaluator`.** It answers yes or no for one claim a call, with no quote: eight times the calls and nothing to show a person.
- **A workflow engine or a message queue for runs.** One table and one scheduled worker do the same for the load expected, with nothing new to operate.

## Consequences

- New dependency edges `matching` → `ai`, `search`, `solution`, `usecase`, recorded in `ModulithArchitectureTest` and `ARCHITECTURE.md`.
- Publishing or changing a use case costs a run (about 40 calls) while a model is chosen for the task.
- The rule of the groups is code and is the first version: it is confirmed or changed against GenAI Fund's own longlists (BEY-41).
