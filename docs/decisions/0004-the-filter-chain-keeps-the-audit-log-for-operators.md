# ADR 0004: The filter chain keeps the audit log for operators

- Status: Accepted, implementation started 2026-10-05
- Date: 2026-10-05
- Decision owner: BeyondPilot team

## Context

[ADR 0003](0003-an-audit-module-that-modules-record-through.md) made `audit` a module without dependencies that `identity` records through, and left open how reading the record is authorized. Reading needs the operator role ([BEY-49](../increments/completed/bey-49-admin-audit-log/design.md)). Only `identity` knows the role, and `identity` already depends on `audit`, so `audit` can neither call `identity` nor take its `Actor`.

The role is not in the session: a session's principal carries no authority, and every operator operation reads the role from the database, so that a withdrawn role or a disabled account stops at once (BEY-48).

## Decision

- **`identity` publishes the operator check as a Spring Security type**: a bean named `operatorsOnly` of type `AuthorizationManager<RequestAuthorizationContext>`, which reads the caller's role from the database on every request.
- **The one filter chain, in `config`, applies it to `/api/audit/**`.** `config` takes the bean by its Spring Security type and its name, as it already takes the sign-in pieces of `identity`, so no module names a class of another and no module edge is added.
- **Without the bean the path is closed.** The chain denies `/api/audit/**` when no module supplies the check.
- **`audit`'s read service takes no caller.** `AuditLog` trusts the chain. A module that calls it directly answers for who reads.

## Alternatives considered

- **The endpoint lives in `identity`** and calls a read service `audit` publishes. The audit log's HTTP contract would sit in another module.
- **`audit` declares the interface it needs and `identity` implements it.** An interface with one implementation by nature, and a second place that knows how a session names its account.
- **The role as an authority in the session.** One line in the chain, but a withdrawn or disabled operator would keep reading until the session ends.
- **`audit` listens to events**, the fallback of ADR 0003. It removes the writing edge, not the reading one.

## Consequences

- This is the one place where authorization is not the application service's: the rule "the application service checks the caller" holds for every module that can name the caller, and `audit` cannot.
- A path under `/api/audit/` is for operators by its place. A module that later needs an operators-only path and cannot depend on `identity` adds its matcher beside it.
- The bean's name is a contract between `identity` and `config`. Renaming it closes the audit log, which `AuditLogTest` catches.
- Modules that can depend on `identity` keep checking in their application service with the caller's `Actor`.
