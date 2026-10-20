# Audit record

The audit record keeps who made a sensitive change, to what, and when. Operators read it at Admin › Audit log. It is
decided in [ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md) and
[ADR 0004](../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md), and was delivered by
[BEY-48](../increments/completed/bey-48-admin-accounts/design.md#record-of-sensitive-changes) (writing) and
[BEY-49](../increments/completed/bey-49-admin-audit-log/design.md) (reading). The code is the `audit` application
module, `backend/src/main/java/ai/genaifund/beyondpilot/audit`. What each contract is verified by is in the
[audit matrix](../tests/audit.md).

## Module

- **Published API.** The package root: `AuditTrail` (writes), `AuditRecord` (one event on its way in, with its
  `Actor` and `Resource`), `AuditAction` (the catalog), `AuditLog` (the operators' read; `spreadsheet`, which
  `identity` calls for the download; and `history`, one resource's events newest first as `AuditEntry` records, which
  `mcp` calls for `get_record` after checking the caller is an operator).
- **Internal.** `audit.persistence` holds the SQL: `AuditEventRepository` (insert and count) and
  `AuditEventQueryRepository` (the filtered, keyset-paged read, and one resource's history). `audit.dto` holds `AuditEventListRequest`,
  `AuditEventListResponse` and `AuditEventResponse`. `audit.web` holds `AuditEventsController` and
  `AuditActionConverter`.
- **No module dependency.** The module is closed with `allowedDependencies = { "shared" }`, for the spreadsheet
  writer. It knows no business module, so it never looks up a name: the caller passes the actor's and the resource's
  names with the event. The modules that record through it are `identity`, `program`, `organization`, `solution`,
  `usecase`, `messaging`, `talent`, `proposal`, `notification`, `search`, `ai`, `mcp` and `matching`
  ([ARCHITECTURE.md](../../ARCHITECTURE.md)).

## Record

`audit_event` (`V2__audit_create_events.sql`) holds one row per event:

- **When:** `occurred_at`, set by the database (`default now()`).
- **What:** `action`, the stored name of an `AuditAction`.
- **Who:** `actor_id`, `actor_label` and `actor_email`, as they were when the event was recorded. All three are null
  when the server configuration acted; the constraint `audit_event_actor_named` requires `actor_id` and
  `actor_label` to be both null or both set.
- **To what:** `resource_type`, `resource_id` (text) and `resource_label`, again as they were at the time.
- **Details:** `details`, a JSON object (constraint `audit_event_details_object`, default `{}`) holding only the
  fields the action declares, each as text.
- **Request:** `request_id`, the `request_id` of the request that made the change, as logged and returned in
  `X-Request-Id`; null outside a request.

Rules on the table:

- **Append-only.** The row trigger `audit_event_append_only` refuses every UPDATE and DELETE with "Audit events are
  append-only". Nothing in the module updates or deletes, and there is no retention period: an event is kept for good.
- **No foreign keys.** `actor_id` and `resource_id` point at nothing, so an event never stops an account or a
  resource from being deleted, and the stored labels keep it readable after a rename or a removal.
- **Indexes.** `audit_event_time_idx (occurred_at desc, id desc)` serves the read; `audit_event_resource_idx` and
  `audit_event_actor_idx` serve lookups by resource and by actor.

### Actions

`AuditAction` is the catalog. Each value is stored and published by its name `<subject>.<verb>`; `AuditAction.of`
reads one back and refuses a name the catalog does not hold. The catalog is append-only: a recorded action keeps its
meaning, and adding one is an ordinary change.

- **Declared details.** Each action names the detail fields it may carry. `AuditRecord` refuses any other field with
  an `IllegalArgumentException`, so a slip at one call site cannot put a secret into the record.
- **Secrets.** Never stored as values. A changed AI provider key is recorded as `key`: `kept`, `replaced` or
  `removed`.
- **Not only operators.** Most actions are an operator's; some record what an owner, a member or a person did, such
  as `organization.member_role` and `talent.delete`.
- **Actions nothing records any more.** The catalog only grows, so the log still reads what was recorded before a
  flow was replaced: `talent.enquiry_accept`, `talent.enquiry_decline` and `talent.enquiry_report` were recorded
  before conversations replaced the messages sent through a talent profile, `talent.reject` before asking for
  changes and removing were two decisions, and `solution.enrich` by the one-off enrichment of the old platform's
  records.

The 123 actions, by the module that records them, with their declared detail fields:

| Module         | Actions (detail fields)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`     | `account.disable`; `account.enable`; `account.export` (`count`: how many rows a download holds); `operator.grant` (`source`: `operator`, or `configuration` when an address named in the server configuration becomes an operator at sign-in, with no actor); `operator.withdraw`; `audit.export` (`count`: how many events a download of the audit log holds; recorded by `identity`, which can name the caller); `mcp.app_revoke`, by the person who connected the app or an operator for them; `mcp.host_add`; `mcp.host_remove`; `mcp.other_hosts_allow`; `mcp.other_hosts_refuse`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `program`      | `program.create`; `program.update`; `program.publish`; `program.unpublish`; `program.feature`; `program.unfeature`; `program.luma_read`; `program.export` (`count`: how many programs a download holds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `organization` | `organization.create`; `organization.approve`; `organization.suspend` (`reason`); `organization.restore`; `organization.update`; `organization.invite` (`role`); `organization.invitation_revoke`; `organization.refuse` (`reason`); `organization.send_back`; `organization.claim_approve` (`account`); `organization.claim_decline` (`account`); `organization.member_role` (`account`, `role`); `organization.member_remove` (`account`); `organization.merge` (`into`: the organization kept); `organization.export` (`count`: how many organizations a download holds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `solution`     | `solution.create`; `solution.publish` (an operator's, with no review); `solution.approve`; `solution.send_back`; `solution.reject` (`reason`; before BEY-76 it also recorded taking an approved solution out of the directory); `solution.take_down` (`reason`); `solution.restore`; `solution.back`; `solution.feature`; `solution.unfeature`; `solution.offers_choose`; `solution.offer_create`; `solution.offer_update`; `solution.offer_close`; `solution.offer_reopen`; `solution.offer_delete`; `solution.deployment_approve`; `solution.deployment_reject` (`reason`); `solution.deployment_withdraw` and `solution.deployment_restore`, by a member of the solution's organization; `solution.export` (`count`); `solution.offers_export` (`count`: how many rows a download holds)                                                                                                                                                                                                                                                                                                                                                             |
| `usecase`      | `use_case.create` (`organization`, `status`: `draft` or `published`); `use_case.submit` (`organization`); `use_case.draft` (`organization`, `from`); `use_case.approve` (`organization`); `use_case.send_back` (`organization`); `use_case.feature` (`organization`); `use_case.unfeature` (`organization`); `use_case.set_programs` (`organization`); `use_case.export` (`count`: how many rows a download holds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `messaging`    | `messaging.request_accept`; `messaging.request_decline`; `messaging.request_report`: the answer to a first message, on a resource of type `conversation`; `messaging.program_assign` (`account`: the operator a program's conversation is assigned to)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| none any more  | `talent.enquiry_accept`; `talent.enquiry_decline`; `talent.enquiry_report`: recorded before conversations replaced the messages sent through a talent profile; `solution.enrich` (`fields`, `evidence`: the parts filled from public sources, and the quote and source of each)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `talent`       | `talent.approve`; `talent.reject` (`reason`; recorded before asking for changes and removing were two decisions); `talent.request_changes` (`reason`); `talent.remove` (`reason`); `talent.restore`; `talent.feature`; `talent.unfeature`; `talent.delete`; `talent.export` (`count`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `proposal`     | `proposal.criteria_update` (`count`); `proposal.reviewer_invite` (`email`); `proposal.reviewer_remove` (`email`); `proposal.decide` (`decision`: `shortlisted` or `not_selected`); `proposal.release` (`shortlisted`, `not_selected`: how many applicants each group had); `proposal.file_open` (`application`, `file`: the identifiers of the application and of the file a reviewer opened; written until 14 October 2026 only); `proposal.export` (`count`: how many applications the download holds); `proposal.drafts_export` (`count`: how many drafts not submitted the download holds); `use_case_proposal.export` (`count`: how many proposals a use case received the download holds, on a resource of type `use_case`); `proposal.draft_open` (`application`: the draft an operator read; written on 14 October 2026 only); `use_case_proposal.decide` (`decision`: `shortlisted` or `declined`, on a resource of type `use_case_proposal`, by a member of the posting organization or an operator); `use_case_proposal.outcomes_send` (`sent`, `shortlisted`, `declined`: how many senders were e-mailed, on a resource of type `use_case`) |
| `notification` | `email.settings_update` (`provider`); `email.appearance_update`; `email.template_update`; `email.template_reset`; `email.suppression_add`; `email.suppression_remove` (`reason`); `email.resend`; `email.test_send` (`subject`: `settings` or the kind of email whose draft was sent)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `search`       | `search.model_change` (`model`); `search.semantic_enable`; `search.semantic_disable`; `search.index_rebuild`; `search.embedding_retry` (`count`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mcp`          | `mcp.user_server_enable`; `mcp.user_server_disable`; `mcp.tool_enable`; `mcp.tool_disable`, on a resource `server.tool`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `matching`     | `matching.run_start` (`origin`: `operator` or `member`); `matching.candidate_add` (`solution`); `matching.candidate_shortlist` (`solution`); `matching.candidate_remove` (`solution`, `reason`); `matching.candidate_reason` (`solution`, `reason`: given after the removal); `matching.candidate_restore` (`solution`); `matching.candidate_invite` (`solution`, `provider`: the organization emailed); `matching.settings_change`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ai`           | `ai.provider_create` (`vendor`: `openai` or `openrouter` for embedding, the adapter `openai` or `anthropic` for chat); `ai.provider_update` (`vendor`, `key`); `ai.provider_delete`; `ai.model_add`, `ai.model_update` and `ai.model_remove` (`provider`); `ai.task_model_change` (`model`, `reasoning`, or `ocr` when an OCR provider reads document pages); `ai.usage_export` (`count`: how many calls a download of the AI usage log holds)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

On the review, takedown and candidate removal actions, `reason` is the code of the reason given. On
`email.suppression_remove` it is why the address had been suppressed.

## Recording

`AuditTrail.record(AuditRecord)` is called by the application service that makes the change, inside that change's
transaction.

- **Transaction required.** The method is `@Transactional(propagation = MANDATORY)`: called without an open
  transaction it throws `IllegalTransactionStateException` and writes nothing.
- **Rollback.** A change that rolls back leaves no event.
- **Failed writes.** The insert has no savepoint: an event that cannot be written fails the change
  ([ADR 0003](../decisions/0003-an-audit-module-that-modules-record-through.md) explains why this differs from
  MemoryOS).
- **Log line.** Each event is also one INFO line, `event=audit.event.recorded`, with `audit_event_id`, `action`,
  `actor_id` (`configuration` when there is no actor), `resource_type` and `resource_id`. Names and addresses stay in
  the table.
- **Counting.** `AuditTrail.count(action, actorId, since)` returns how many events of one action an actor recorded
  since a moment. `notification` uses it to limit `email.test_send` to 10 tests to other people per operator per hour.

## Reading

`GET /api/audit/events` (`listAuditEvents`, `AuditEventsController`) returns one page of `AuditEventList`, newest
first.

- **Who may read.** Only operators. The `audit` module cannot ask who is an operator, so the filter chain in
  `config.SecurityConfiguration` guards `/api/audit/**` with the `operatorsOnly` bean that `identity` publishes
  ([ADR 0004](../decisions/0004-the-filter-chain-keeps-the-audit-log-for-operators.md)). The bean reads the role from
  the database on every request, so a withdrawn role stops reading at once. Without the bean the path is denied.
  Nobody signed in gets `401`; a signed-in account that is not an operator gets a `403` problem.
- **No caller in the service.** `AuditLog` takes no caller and trusts the chain. A module that calls it directly
  answers for who reads.

| Query parameter | Contract                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`          | An ISO instant; only events at or after it                                                                                                                |
| `action`        | A stored action name, such as `account.disable`; only events of that action                                                                               |
| `q`             | Up to 100 characters; events whose actor's name or address, or whose resource's label, contains it, ignoring case. `%`, `_` and `\` are matched literally |
| `before`        | The `older` cursor of a page: the page of events before it. Used when both cursors are given                                                              |
| `after`         | The `newer` cursor of a page: the page of events after it                                                                                                 |

- **Response.** `items`, each an `AuditEvent`: `id`, `occurredAt`, `action` (its stored name), `actor` (`id`,
  `label`, `email`) or null, `resource` (`type`, `id`, `label`), `details` and `requestId`. `older` is the cursor
  for the page towards the past, null on the oldest page; `newer` is the cursor for the page towards the present,
  null on the newest page.
- **Paging.** Keyset by `(occurred_at, id)`, 50 events per page, a fixed size. A cursor is the event's
  `occurred_at` in microseconds since the epoch, an underscore, and its id. The read fetches one row more than a page
  to know whether a further page exists; paging towards the present reads in ascending order and reverses the page.
  There is no total and no page number.
- **Validation.** A cursor that does not match its form, an unknown `action`, a `from` that is not an instant or a
  `q` over 100 characters is a `400` problem.

## Viewer

Admin › Audit log (`/admin/audit-log`, `web/src/features/audit`) is for operators: a visitor is sent to sign in, and
a signed-in account that is not an operator gets the not-found page.

- **Filters in the address:** `?period=&action=&q=&before=&after=`. `period` is `day`, `week` (the default),
  `month` (30 days) or `all`, and becomes `from` when the page reads. A change of filter drops the cursors.
- **The action filter** offers every action the backend publishes, grouped by the areas of the admin sidebar
  (`audit-log-search.ts`). The list is checked against the generated `AuditEvent["action"]` when the web is compiled,
  so an action added in the backend and missing from the filter fails `pnpm check`. It opens with a field that narrows
  the hundred-odd actions as one types, keeping each area with what matches (BEY-170, F-084).
- **Rows:** time, person and activity. An event without an actor names "System". The activity is a sentence from the
  action's wording in the message catalogs (`Admin.auditLog`), ending in the resource's label. A row is the whole
  event; nothing opens.
- **Paging:** Previous and Next links that carry `after` and `before`, with no count. A cursor that is not one, or a
  page that holds nothing, leads back to the newest events with the filters kept. A read refused with `401` or
  `403` shows the not-found page.
- **Layout:** a table at every width, scrolled sideways where it does not fit.
