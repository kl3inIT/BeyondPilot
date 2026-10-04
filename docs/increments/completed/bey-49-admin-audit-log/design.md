# BEY-49 — Admin: the audit log

Status: delivered on 5 October 2026 ([plan](plan.md)); the screens were approved in Figma the same day (section `Admin — Audit log`). It is the reader of the record that [BEY-48](../bey-48-admin-accounts/design.md#record-of-sensitive-changes) started writing, and the second screen inside the admin frame. The research behind the screen is in [docs/research](../../../research/2026-10-05-admin-audit-log.md).

## Domain story

An operator opens Admin › Audit log and sees what operators and the server configuration changed in the last seven days, newest first. Each line says when, who, and what was done to whom.

- A colleague finds their account disabled: the operator searches the colleague's name and sees who disabled it and when.
- The team reviews who holds the operator role: the operator filters by "Made operator" over all time.
- An event looks wrong: the operator tells a developer the person and the time, and the developer finds the event and its request identifier through the API or the table.

_Failures:_ someone who is not an operator asks for the log (refused, and nothing is revealed in the web application); the filters match nothing (the screen says so and offers to clear them); a link holds a cursor that is not one (refused as a bad request).

## Glossary

The terms are those of BEY-48: **audit event**, **action**, **actor**, **resource**. One is added.

| Term       | Meaning                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Period** | How far back the list looks: the last 24 hours, 7 days or 30 days, or all time. The default is 7 days |

The owner is the `audit` module, which owns `audit_event`.

## Read model

One read model, the event list, and no command: the record is append-only.

| Kind       | Name       | Rule                                                       |
| ---------- | ---------- | ---------------------------------------------------------- |
| Read model | Event list | Every event, filtered, newest first, paged; operators only |

## API

### `GET /api/audit/events` (`listAuditEvents`)

Session required, operators only.

| Query parameter | Values                             | Meaning                                                                                     |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `from`          | An instant; optional               | Only events at or after it                                                                  |
| `action`        | A value of the catalog; optional   | Only this action, for example `account.disable`                                             |
| `q`             | Up to 100 characters; optional     | Events whose actor's name or address, or whose resource's label, contains it, ignoring case |
| `before`        | A cursor from a response; optional | The page of events older than the cursor                                                    |
| `after`         | A cursor from a response; optional | The page of events newer than the cursor                                                    |

Response `200`, `AuditEventListResponse`: `items`, `newer` and `older`.

- Each item is an `AuditEventResponse`: `id`, `occurredAt`, `action`, `actor` (`id`, `label`, `email`) or null, `resource` (`type`, `id`, `label`), `details` (an object of strings) and `requestId`.
- `older` is the cursor of the next page towards the past, or null on the last one; `newer` is the cursor of the page towards the present, or null on the first one. A cursor is opaque to the caller; it encodes `(occurred_at, id)` of the item at that edge.
- The page size is 50 and fixed.
- A cursor that is not one, an unknown `action`, a `from` that is not an instant or a `q` over 100 characters is a `400` problem. When both cursors are given, `before` is used.
- `action` is published as an enumeration in `openapi.yml`, generated from the catalog, so the web application's filter cannot offer an action the server does not know.

**Paging is by cursor in both directions, not by page number.** The table only grows, the newest events are the ones read, and a page number would count every matching row and shift under the reader whenever an event is recorded. `V2` already carries the index `(occurred_at desc, id desc)` for it. Two cursors rather than one let the address alone say which page is shown, so the server can render any page without the browser remembering where it came from. This is the second paged list of the API and it differs from the first on purpose: the [account list](../bey-48-admin-accounts/design.md#api) is a small set a person jumps around in, and keeps `page` and `total`.

## Authorization

Reading needs the operator role, and the role is known only to `identity`, which already depends on `audit`. `audit` therefore cannot call `identity`, nor take its `Actor`.

**Decided ([ADR 0004](../../../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md)): `identity` publishes the operator check as a Spring Security `AuthorizationManager` bean, and the filter chain in `config` applies it to `/api/audit/**`.**

- It is the first of the two ways [ADR 0003](../../../decisions/0003-an-audit-module-that-modules-record-through.md) left open, and the way `identity` already hands its sign-in pieces to the filter chain: by a Spring Security type, so neither `config` nor `audit` names an `identity` class and no module edge is added.
- The bean reads the role from the database on every request, as `AccountAdministration` does. The session carries no authority, so a withdrawn role stops reading at once.
- `SecurityConfiguration` takes the bean through an `ObjectProvider` and denies `/api/audit/**` when it is absent: it fails closed.
- A refusal is the `403` problem the chain already answers with.
- This departs from "the application service checks the caller" for this one module: `audit`'s read service takes no caller and trusts the chain. The alternative that keeps the rule is worse on every other count.

Alternatives:

- **The endpoint lives in `identity`** and calls a read service `audit` publishes. No new wiring, but the audit log's HTTP contract would sit in another module, and `audit` would publish an unguarded read that any module may call.
- **`audit` declares the interface it needs and `identity` implements it.** An interface with one implementation by nature, which the [change design rules](../../../conventions.md#change-design) refuse, and a second place that knows how a session names its account.
- **The role as an authority in the session.** One line in the chain, but a withdrawn or disabled operator would keep reading until the session ends; BEY-48 chose the database for that reason.
- **`audit` listens to events**, ADR 0003's fallback. It solves the writing side's edge, not the reading side's.

The web page calls `requireRole("operator")`; a signed-in person who is not an operator gets the not-found page, as on the other admin pages.

## Persistence

- No migration. The list reads `audit_event` through the index `(occurred_at desc, id desc)`.
- A `JdbcClient` query repository, `AuditEventQueryRepository`, in `audit.persistence`: one keyset query. Paging towards the present reads in ascending order and reverses the page. It fetches one row more than the page to know whether a further page exists.
- Search matches the lowercased actor label, actor address and resource label with an escaped `like`, without an index. The table gains a few rows per day; a trigram index waits for a measurement.
- The stored labels make the list complete on its own: no join to `identity`, and an event stays readable after its account is renamed.

## Web

- **Route** `src/app/[locale]/admin/audit-log/page.tsx`: `requireRole("operator")`, then the list read on the server from the address's parameters. The sidebar gains its third destination, Audit log, and the breadcrumb follows from the same list.
- **Feature** `src/features/audit/`: the page, the toolbar, the search parameters and the server read, and the map from an action to its wording.
- **Reading** follows the [list rules](../../../conventions.md#lists) the Accounts screen set: a Server Component reads by the address (`?period=&action=&q=&before=&after=`), nuqs writes it with `shallow: false`, the search waits 300 ms. A change of filter drops the cursor. The page turns `period` into `from` when it reads; the API knows instants, not presets.
- **Columns:** Time, Person, Activity. The time reads as on the Accounts screen ("Today, 14:05"), with the full date and time to the second in a tooltip. The person is the `Person` composite, which takes an icon in place of initials for "System", the actor of an event the configuration made. The activity is a sentence from the action, ending in the resource's label.
- **A row is the whole event; nothing opens.** Decided on 5 October 2026 after the first drawing, which opened an event in a sheet as MemoryOS, Railway and Stripe do. Those are products for engineers. With the stored action name, the UTC time, the resource's type and the three identifiers taken out, because an operator can do nothing with them, the sheet said only what its row already says. A detail view arrives with the first action whose details do not fit a line. The API still returns `id`, `details` and `requestId` for a developer who traces a change.
- **Under the list:** the registry `pagination` with Previous and Next only, as links that carry `after` and `before`, in a new `DataTablePager` beside `DataTableFooter`; there is no count. A page that holds nothing, or a cursor that is not one, leads back to the newest events.
- **Empty states:** no event in the period, and nothing matching the filters, each inside the table frame; the second offers to clear the filters.
- **Below 768px** each event is a stacked row, as on the Accounts screen.
- **Wording** for each action and each detail field lives in both message catalogs under `Admin.auditLog`. An action the web application has no wording for yet shows its stored name.

## Design system

No new token and no new Figma component; `DataTablePager` joins the list composites. The `AdminSidebar` component gains the Audit log item.

## Not in this increment

A detail view of one event, export, a retention period, a free date range, a link from an event to the account it concerns, and events from modules other than `identity`. Each waits until something asks for it.
