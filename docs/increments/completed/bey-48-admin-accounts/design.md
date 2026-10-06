# BEY-48 — Admin: accounts, the operator role, and switching an account off

Status: delivered on 4 October 2026 ([plan](plan.md)); the screens were approved in Figma the same day (section `Admin — Accounts`). It is step 3 of the [identity increment](../bey-30-identity/design.md), widened from "grant and withdraw the operator role" to the whole account list, and the first screen inside the admin frame of BEY-44. The research behind the screen is in [docs/research](../../../research/2026-10-04-admin-accounts.md).

## Domain story

An operator opens Admin › Accounts and sees everyone who has signed in, newest sign-in first. They look a person up by name or address, or narrow the list to disabled accounts or to operators.

- A colleague joins GenAI Fund: the operator finds their account and makes them an operator. The colleague can open the admin area on their next request.
- A colleague leaves: the operator withdraws the role. The former operator keeps their account and loses the admin area at once.
- An account is abused: the operator disables it. The person is signed out at once and cannot sign in again; nothing they submitted is removed. The operator can enable the account later.

_Failures:_ the operator acts on an account another operator has just changed (the action is repeated safely, see [concurrency](#concurrency-and-repetition)); someone who is not an operator calls the API (refused, and nothing is revealed in the web application); an operator tries to disable or demote themselves (refused, so an environment cannot lose its last way in by a slip).

## Glossary

| Term                    | Meaning                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Account**             | A person who signs in, as in BEY-30. Created by the first sign-in; there is no invitation                                      |
| **Operator**            | An account whose platform role is `operator`: GenAI Fund staff                                                                 |
| **Configured operator** | An operator whose address is in `BEYONDPILOT_IDENTITY_OPERATOR_EMAILS`. The configuration gives the role back at every sign-in |
| **Disabled**            | An account that cannot sign in and whose open sessions stop                                                                    |

The owner of all of it is the `identity` module, which already owns `identity_account`. The record of who changed what belongs to a new module, `audit` ([below](#record-of-sensitive-changes)).

## Commands, read model and invariants

| Kind       | Name              | Rule                                              |
| ---------- | ----------------- | ------------------------------------------------- |
| Read model | Account list      | Every account, filtered and paged; operators only |
| Command    | Disable account   | Not oneself                                       |
| Command    | Enable account    | —                                                 |
| Command    | Grant operator    | —                                                 |
| Command    | Withdraw operator | Not oneself; not a configured operator            |

Each command sets a state rather than toggling one, so repeating it changes nothing.

## API

All under `/api/identity/accounts`, session required, operators only. Every refusal is the shared problem.

### `GET /api/identity/accounts` (`listAccounts`)

| Query parameter | Values               | Meaning                                                   |
| --------------- | -------------------- | --------------------------------------------------------- |
| `q`             | Up to 100 characters | Accounts whose name or address contains it, ignoring case |
| `status`        | `active`, `disabled` | Only this status                                          |
| `role`          | `user`, `operator`   | Only this role                                            |
| `page`          | From 1; default 1    | The page                                                  |

Response `200`, `AccountListResponse`: `items` (each an `AccountSummaryResponse`: `id`, `email`, `displayName` or null, `role`, `status`, `lastSignInAt` or null, `createdAt`, and `configuredOperator`), `page`, `pageSize` (25, fixed), `total`.

- Order is fixed: latest sign-in first, accounts that never completed one last, then newest first. No sort parameter until a screen needs one.
- A page past the end answers `200` with no items and the true `total`.
- An unknown value of `status` or `role`, a `page` below 1 or a `q` over 100 characters is a `400` with the violation's pointer.

This is the first paged list of the API, so it sets the shape the later ones follow: `page` counted from 1, `items`, `page`, `pageSize`, `total`.

### Commands

| Request                                              | `operationId`      | Success | Refusals beyond 401                                                              |
| ---------------------------------------------------- | ------------------ | ------- | -------------------------------------------------------------------------------- |
| `POST /api/identity/accounts/{id}/disable`           | `disableAccount`   | `204`   | `403` not an operator; `404` no such account; `409` `IDENTITY_OWN_ACCOUNT`       |
| `POST /api/identity/accounts/{id}/enable`            | `enableAccount`    | `204`   | `403`; `404`                                                                     |
| `POST /api/identity/accounts/{id}/grant-operator`    | `grantOperator`    | `204`   | `403`; `404`                                                                     |
| `POST /api/identity/accounts/{id}/withdraw-operator` | `withdrawOperator` | `204`   | `403`; `404`; `409` `IDENTITY_OWN_ACCOUNT`; `409` `IDENTITY_OPERATOR_CONFIGURED` |

They are POST commands on the account, not PATCH of a field, because each is a transition with its own rule and its own record ([API discovery](../../../conventions.md#api-discovery-and-product-boundaries), point 4).

New failure codes in `IdentityErrorCode`: `IDENTITY_OPERATOR_REQUIRED` (not permitted), `IDENTITY_ACCOUNT_NOT_FOUND` (not found), `IDENTITY_OWN_ACCOUNT` and `IDENTITY_OPERATOR_CONFIGURED` (conflict).

## Authorization

- `AccountAdministration`, the application service of this increment, reads the caller's role from the database first in every operation and throws `IDENTITY_OPERATOR_REQUIRED` otherwise, as the [security rules](../../../conventions.md#data-and-security) ask. A disabled operator is refused too. The check becomes a published operation of `identity` when a second module needs it.
- `SecurityConfiguration` is unchanged: `/api/**` already needs a session. The role is a business rule, checked where the business operation is.
- The web page calls `requireRole("operator")`; a signed-in person who is not an operator gets the not-found page, as for the admin home.

## Record of sensitive changes

The brief asks to "keep appropriate records of sensitive changes and proposal access" (§7.10). Decided on 4 October 2026: the record is a table from the start, because operators are its readers and it has to hold from the first change on. The shape follows the audit of MemoryOS, the sibling project this backend is modelled on (its ADR 0013 "Server-authored audit evidence", `V95__audit_event.sql` and the package `io.memoryos.audit`), cut down to what this product has.

**A new module, `audit`.** `identity` records account changes now; `proposal` will record who opened and decided a proposal, and `program` who published one. A writer several modules call is its own closed module with no dependency; `identity` gains the edge `identity → audit`. That is a boundary change, recorded as an ADR once implementation starts.

| Term            | Meaning                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit event** | One thing someone did that changed who may do what, or touched something sensitive. Written once, never changed                                                     |
| **Action**      | What happened, from a closed catalog: `account.disable`, `account.enable`, `operator.grant`, `operator.withdraw`. A value never changes meaning; new ones are added |
| **Actor**       | Who did it. Empty when the server configuration did it, as when a configured address becomes an operator on signing in                                              |
| **Resource**    | What it was done to: here an account                                                                                                                                |

**Table `audit_event`** (`V2__audit_event.sql`): `id`, `occurred_at`, `action`, `actor_id`, `actor_label`, `actor_email`, `resource_type`, `resource_id`, `resource_label`, `details` (a JSON object), `request_id`.

- **Append-only.** A trigger rejects every UPDATE and DELETE.
- **Readable after a rename or a removal.** `actor_id` and `resource_id` are not foreign keys, and the name and address of the actor and the label of the resource are stored as they were at that moment.
- **The caller supplies the labels.** The audit package of MemoryOS reads another module's table for them; here a module never reads the table of another, so `identity` passes the names it already holds.
- **Declared details.** Each action names the fields its `details` may carry; an undeclared field is refused, so a slip at one call site cannot put a secret into the record.
- **In the transaction of the operation.** A change that rolls back leaves no event. Unlike MemoryOS, a failed event write fails the operation: one database, one transaction and a handful of operators make a complete record cheaper than a recovery path.
- **The log line stays.** Each event is also one INFO line (`audit.event.recorded` with the action and the identifiers, no address), so shipping logs elsewhere later needs no new instrumentation.
- **Personal data.** The table holds names and addresses, which logs may not; it is data the product owns, behind the operator check.

Published by `audit`: `AuditTrail.record(AuditRecord)`, `AuditAction` and `AuditRecord`.

Left out, each until something needs it: an outcome column (only successes are recorded; a refused attempt by someone who is not an operator is not evidence of anything), a class for routing to a SIEM, the source address, export, and a retention sweep. The read API and the screen are the next admin screen, drawn and approved before they are built; that design also settles how reading is authorized without making `audit` and `identity` depend on each other.

## Concurrency and repetition

Two operators may act on one account at the same moment. Each command sets a state and takes a row lock on the account it changes, so the two act one after the other and the result is the same whichever lands last. The list is read without locks and may be one action behind until it is read again.

## Persistence

- Commands load the `Account` entity through `AccountRepository` and call a method on it: `disable()`, `enable()`, `makeOperator()` (exists), `withdrawOperator()`.
- The list is a projection with filters and a count, so it gets a `JdbcClient` query repository, `AccountQueryRepository`, in `identity.persistence` ([persistence](../../../guidelines/persistence.md#implementation-boundaries)): one query for the page, one for the total.
- Search matches `lower(email)` and `lower(display_name)` with an escaped `like`. The table holds the people who signed in, thousands at most in Phase 1; no trigram index until a measurement asks for one.
- No migration: every column exists since `V1`.

## Web

- **Route** `src/app/[locale]/admin/accounts/page.tsx`: `requireRole("operator")`, then the list read on the server from the URL's parameters, then the page component. The sidebar gains its second destination, Accounts.
- **Feature** `src/features/identity/`: `accounts-page.tsx`, its parts (toolbar, table, stacked rows for a phone, row menu), `accounts-queries.ts` (the search parameters and the server read) and the confirmation wording.
- **Reading.** The list is rendered on the server on every navigation, uncached, with the session cookie forwarded. Search and filters are the URL (`?q=&status=&role=&page=`), written through nuqs with `shallow: false` so a change asks the server again; the search field waits 300 ms after typing. A filter or search change returns to page 1.
- **Writing.** The row menu calls the generated SDK from the browser; on success the page is refreshed (`router.refresh()`) and a toast names what happened; a refusal shows the translated message of its `code`.
- **Confirmation.** Disable, grant and withdraw open the alert dialog first; its confirm button shows the pending state and the dialog stays open until the command has answered. Enable happens at once: it is the undo.
- **Where a person is.** The bar above the page carries the breadcrumb, "Admin › Accounts", from the same list of destinations the sidebar shows.
- **One's own row** has a "You" badge and no menu. A configured operator's menu has no "Withdraw operator role".

**Decided on 4 October 2026: the list is built the way the App Router is meant to be used, without TanStack Query and without TanStack Table.** The plan of BEY-45 expected both here.

- Three of the four references use both, and all three render nothing on a server: the Medusa admin and MemoryOS are Vite applications, and Dub fetches in the browser. They need a client cache and a client table engine because the browser is the only place their list exists.
- Payload is the one built like this application. Its list is a Server Component that reads by the parameters of the URL; a filter writes the URL inside a transition (`router.replace`) and the server renders again; a save ends in `router.refresh()`; the page returns to 1 when the search or a filter changes. It uses neither library. Its columns come from collection configuration, which does not transfer; the URL as the state and the refresh after a write do.
- So: a Server Component reads the list, the registry `table` primitive draws it, nuqs writes the URL, and a write ends in a refresh. One `DataTable` composite on the primitive holds what every list repeats: the frame, the header row, the empty and no-results states, the footer with the count and paging. Later lists use it, so there is one table system.
- TanStack Table arrives with the first table that keeps state in the browser: sorting by a column header, hiding columns, virtual rows. Selecting rows on a server-rendered page is a set of identifiers and does not need it. TanStack Query arrives with the first screen that keeps server data in the browser: polling, optimistic updates, a draft that outlives navigation.
- `docs/conventions.md` (Frontend › Stack) is amended in this change to say when each of the two is used.

nuqs and four composites arrive here, with their first use: `DataTable` (the frame, the empty state and the footer with the count and the registry pagination), `ConfirmDialog` on `alert-dialog`, `Status` and `Person`; and `useNotify`, the toast helper that takes message keys. The confirmation is a controlled dialog beside the menu that opens it, not a provider with a hook: one place opens it, and a provider would add a second way to do the same.

## Design system

No new token. The role tokens cover it: `success` for the Active dot, `muted-foreground` for the Disabled one, `border`, `muted` and `muted-foreground` for the avatar, `destructive` for the red menu item and button.

- **`Status`** (new, `src/components/composites/`): a dot and a word, with `tone` `success`, `warning`, `info`, `destructive` or `neutral`. Which status of a domain takes which tone is a small map beside that domain's code, not a token.
- **`Badge`**: the existing `outline` variant for "Operator" and "You".
- **Avatar**: the registry `Avatar` with initials as its fallback, as in the sidebar's foot. The header's account button keeps its own approved look; it is a button, not a list avatar.

Three places where the built screen differs from the drawing, each for a reason found while building:

- The initials of a disabled account are not dimmed. At 60% they fell to a contrast of 2.6 against the 4.5 a reader needs, which the accessibility check caught; the name is quieter and the status says "Disabled".
- The footer shows the registry pagination with page numbers when there is more than one page, and nothing but the count when there is one, where the drawing had two disabled buttons.
- The search field and the two selects are 32px high, the registry's `input-group` height, where the drawing had 40px.

## Verification

- Backend, real HTTP against PostgreSQL (`IdentityAccountsTest`): the list's filters, search, order, paging and bounds; each command and its repetition; that a disabled account's session stops; that a withdrawn operator loses the list at once; each refusal with its code; that nobody but an operator gets anything.
- `OpenApiContractTest` for the five operations; `ModulithArchitectureTest` lists `audit` and the edge from `identity`.
- Each command writes its audit event with the actor and the account as they were; a refused or rolled-back command writes none; an event can be neither updated nor deleted.
- Web, Playwright with the stub backend extended to answer the list and the commands: the three widths, search and filters writing the URL, each confirmation, the refusals, the no-results state, and the page being absent for a non-operator.
- The matrix is recorded in `docs/tests/identity.md`.

## Not in this increment

Editing a name or an address; deleting an account; inviting someone who has not signed in; an organisation column; bulk actions; a detail page; reading the audit events (the API and the screen).
