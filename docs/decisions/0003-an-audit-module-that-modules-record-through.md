# ADR 0003: An audit module that modules record through

- Status: Accepted, implementation started 2026-10-04
- Date: 2026-10-04
- Decision owner: BeyondPilot team

## Context

The brief asks the platform to "keep appropriate records of sensitive changes and proposal access" (§7.10). The first such changes arrive with the operators' Accounts screen ([BEY-48](../increments/active/bey-48-admin-accounts/design.md)): disabling and enabling an account, granting and withdrawing the operator role. Later modules add their own: who opened and decided a proposal, who published a program, who approved a listing.

Operators are the readers of this record, and it has to hold from the first change on; a record that starts later has a hole no one can fill. Log lines alone do not serve: an operator cannot read the server's logs, and logs may not carry the names and addresses that make an event readable ([logging](../conventions.md#logging)).

The team's reference project, MemoryOS, went through this decision twice. It first removed an audit table that had no reader (its ADR 0003), then brought one back when the readers were named (its ADR 0013, "Server-authored audit evidence"). This decision follows the second and takes its shape, cut to what this product has.

## Decision

- **A module of its own, `audit`**, closed and without dependencies. It publishes `AuditTrail.record(AuditRecord)`, the catalog `AuditAction` and the record type. A module that makes a sensitive change depends on `audit` and records the change itself. The first edge is `identity → audit`.
- **One append-only table, `audit_event`.** A trigger rejects every UPDATE and DELETE.
- **Readable after a rename or a removal.** The actor and the resource are stored by identifier without foreign keys, together with the name and address they had at that moment. The caller supplies those names: a module never reads the table of another, so `audit` does not look them up.
- **A closed catalog of actions, each declaring the fields its details may carry.** A recorded action never changes meaning, and a field it did not declare is refused, so a slip at one call site cannot put a secret into the record.
- **Written in the transaction of the change.** A change that rolls back leaves no event, and an event that cannot be written fails the change.
- **Each event is also one log line** with the action and the identifiers and without names, so shipping logs to another system later needs no new instrumentation.

## Alternatives considered

- **Log lines only, a table when the audit screen is built.** This was the first proposal for BEY-48. Rejected by the owner: the reader exists, and the record must be complete from the first change.
- **Each module keeps its own history table.** One screen would then read several tables with several shapes, and every module would repeat the append-only guarantee.
- **`audit` listens to events the modules publish.** It would keep `identity` free of the edge, at the price of an event type per change in every module, of `audit` depending on every module it listens to, and of the event's transaction coupling living in listener configuration instead of one call. Kept as the fallback if reading the record has to depend on `identity` in a way that would close a cycle.
- **A failed event write does not fail the change**, as MemoryOS chose, with a savepoint and a re-emitted log line. That favours the availability of administration over the completeness of the record. With one database, one transaction and a handful of operators, a complete record costs less than that recovery path.

## Consequences

- Every module that makes a sensitive change gains a dependency on `audit`, and a new sensitive operation is expected to record its event; a review checks for it.
- The table holds names and addresses. It is the product's data, readable only by operators once the read API exists.
- Not built, each until something needs it: an outcome for refused attempts, the source address, export, a retention period, and a class for routing events to another system.
- The read API and its screen are a later increment. Its design decides how reading is authorized without `audit` and `identity` depending on each other: an authorization adapter published by `identity` as a Spring Security interface, as its sign-in adapters already are, or the listener alternative above.
