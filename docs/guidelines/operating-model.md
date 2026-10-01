# Repository operating model

BeyondPilot uses the repository as its durable system of record. The model is adapted from [glebfox/playbook — Repository as System of Record](https://github.com/glebfox/playbook/blob/main/harness/operating-model.md).

## Goals

- A new team member or a fresh agent session finds the current state without reconstructing chat history.
- Each fact has one canonical home.
- Readers start from a small map and open detail only as needed.
- Code, design intent, decisions and verification move together.

## Document layout

| Location | Owns |
| --- | --- |
| `AGENTS.md` | The thin navigation map and the mandatory working rules |
| `CLAUDE.md` | Claude Code's import of `AGENTS.md`; no rules of its own |
| `README.md` | Entry points and basic commands |
| `ARCHITECTURE.md` | The system structure and runtime flows as implemented |
| `docs/brief/` | The client's product brief, kept as received |
| `docs/vision.md` | Product outcomes and stable principles |
| `docs/roadmap.md` | Delivered, active and candidate increments |
| `docs/conventions.md` | Cross-cutting engineering conventions |
| `docs/guidelines/` | Reusable engineering and operational policy per topic |
| `web/AGENTS.md` | The web application's checklist, pointing into the conventions |
| `docs/specs/` | Current behavior and invariants of each module |
| `docs/tests/` | Requirement-to-verification matrix of each module |
| `docs/decisions/` | Accepted, append-only architecture decisions |
| `docs/increments/active/<increment>/` | Design, plan and verification evidence of a change in flight |
| `docs/increments/completed/<increment>/` | The record of an increment after it has landed |
| `docs/runbooks/` | Repeatable developer and operator procedures |

Task status lives in Linear (team BeyondPilot, issues `BEY-<n>`), not in the repository.

## Source classification

Before adding text, choose its owner:

- **Implemented fact:** `ARCHITECTURE.md` or the module's spec.
- **Desired outcome:** vision.
- **Reusable rule:** convention or guideline.
- **Accepted tradeoff:** ADR.
- **Detail of the current change:** the active increment.
- **Repeatable command sequence:** runbook.
- **Task status:** the Linear issue, summarized in the roadmap.

If the same statement would appear twice, keep the detailed version in the deeper source and replace the other copy with a link.

## Increment lifecycle

An increment is one change that adds or alters a business capability: a module, a user journey or a data lifecycle. Tooling, dependency and documentation changes need only their Linear issue.

1. Create `docs/increments/active/<increment>/design.md` and `plan.md` before implementation, named after the Linear issue (for example `bey-21-proposal-submission`). A new module starts with [boundary discovery](../conventions.md#boundary-discovery).
2. Define the outcome a user or an operator will see, the boundaries, the data lifecycle, the failure behavior and the verification plan.
3. Implement a complete vertical slice. Do not make incomplete behavior operable through temporary production code ([change design](../conventions.md#change-design)).
4. Record the commands run and the outcomes observed in `verification.md`; never copy raw logs or secrets.
5. Update the architecture, the module's spec and test matrix, guidelines and ADRs to match the verified implementation.
6. Land the change on `main` ([operating rules](../../AGENTS.md#operating-rules)).
7. Move the increment directory to `docs/increments/completed/` and reconcile `docs/roadmap.md`.

An abandoned increment is kept only if its reasoning is reusable; otherwise delete it. Accepted decisions stay in ADRs.

## Decision lifecycle

Evaluate alternatives in the active increment's `design.md`, or in the Linear issue for a change that has no increment. Create an ADR only after the decision is accepted and implementation has started. ADRs are append-only: a later ADR supersedes an earlier one, and each links to the other.

## Verification and consolidation

Verification exercises the changed surface, not only compiles it ([testing guideline](testing.md#required-gates)). The active increment owns temporary evidence while the change is in flight. Before completion, consolidate stable contracts into `docs/specs/`, stable checks into `docs/tests/`, the current shape into `ARCHITECTURE.md` and repeatable operations into `docs/runbooks/`.

Repository documents win over stale chat or tracker summaries. Current runtime and test evidence wins over stale repository prose; correct the prose in the same change.
