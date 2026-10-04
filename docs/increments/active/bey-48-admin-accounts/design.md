# BEY-48 — Admin: accounts, the operator role, and switching an account off

Status: designed on 4 October 2026; the screens were approved in Figma the same day (section `Admin — Accounts`). Nothing is implemented yet ([plan](plan.md)). It is step 3 of the [identity increment](../bey-30-identity/design.md), widened from "grant and withdraw the operator role" to the whole account list, and the first screen inside the admin frame of BEY-44. The research behind the screen is in [docs/research](../../../research/2026-10-04-admin-accounts.md).

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

The owner of all of it is the `identity` module, which already owns `identity_account`. No module is added and no dependency edge changes.

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

- `IdentityService.requireOperator(Actor)` reads the actor's role from the database and throws `IDENTITY_OPERATOR_REQUIRED` otherwise. Every operation of this increment calls it first, in the application service, as the [security rules](../../../conventions.md#data-and-security) ask. It is published from the module's root, because the admin operations of later modules need the same check.
- `SecurityConfiguration` is unchanged: `/api/**` already needs a session. The role is a business rule, checked where the business operation is.
- The web page calls `requireRole("operator")`; a signed-in person who is not an operator gets the not-found page, as for the admin home.

## Record of sensitive changes

The brief asks to "keep appropriate records of sensitive changes" (§7.10). Each command logs one INFO line: `identity.account.disabled`, `identity.account.enabled`, `identity.operator.granted`, `identity.operator.withdrawn`, with `account_id` (whose account), `actor_id` (who did it) and `source` `operator`. No address is logged.

**Decision to confirm:** these records are log lines for now. A table an operator can read on a screen arrives with the audit-log screen; building it here would add a table with no reader. If GenAI Fund needs to look changes up before that screen exists, the table moves into this increment.

## Concurrency and repetition

Two operators may act on one account at the same moment. Each command sets a state, the entity carries `@Version`, and a lost optimistic lock is retried once; the result is the same whichever lands last. The list is read without locks and may be one action behind until it is read again.

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
- **Confirmation.** Disable, grant and withdraw open the alert dialog first, through one hook that returns a promise; its confirm button shows the pending state. Enable happens at once: it is the undo.
- **One's own row** has a "You" badge and no menu. A configured operator's menu has no "Withdraw operator role".

**Decision to confirm: no TanStack Query and no TanStack Table in this screen.** The plan of BEY-45 expected both here. This list is five fixed columns, read on the server from the URL, changed by four commands that each end in a refresh; a client cache and a table engine would add code without a behaviour to show for it. nuqs, the confirmation hook, the toast helper and the `Status` component do arrive here, with their first use. Query arrives with the first screen that keeps server data in the browser (polling, optimistic updates, a list that outlives navigation); Table with the first screen that sorts by column, selects rows or hides columns, which the applications list of BEY-38 does.

## Design system

No new token. The role tokens cover it: `success` for the Active dot, `muted-foreground` for the Disabled one, `border`, `muted` and `muted-foreground` for the avatar, `destructive` for the red menu item and button.

- **`Status`** (new, `src/components/composites/`): a dot and a word, with `tone` `success`, `warning`, `info`, `destructive` or `neutral`. Which status of a domain takes which tone is a small map beside that domain's code, not a token.
- **`Badge`**: the existing `outline` variant for "Operator" and "You".
- **Avatar**: the registry `Avatar` with initials as its fallback, as in the sidebar's foot. The header's account button keeps its own approved look; it is a button, not a list avatar.

## Verification

- Backend, real HTTP against PostgreSQL (`IdentityAccountsTest`): the list's filters, search, order, paging and bounds; each command and its repetition; that a disabled account's session stops; that a withdrawn operator loses the list at once; each refusal with its code; that nobody but an operator gets anything.
- `OpenApiContractTest` for the five operations; `ModulithArchitectureTest` unchanged.
- Web, Playwright with the stub backend extended to answer the list and the commands: the three widths, search and filters writing the URL, each confirmation, the refusals, the no-results state, and the page being absent for a non-operator.
- The matrix is recorded in `docs/tests/identity.md`.

## Not in this increment

Editing a name or an address; deleting an account; inviting someone who has not signed in; an organisation column; bulk actions; a detail page; the audit-log screen.
