import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

/** How far back the log looks; `week` is the default and `all` has no bound. */
export const auditPeriods = ["day", "week", "month", "all"] as const;

/** The catalog of actions, as the backend publishes it. */
export const auditActions = [
  "account.disable",
  "account.enable",
  "operator.grant",
  "operator.withdraw",
  "program.create",
  "program.update",
  "program.publish",
  "program.unpublish",
  "organization.create",
  "organization.approve",
  "organization.refuse",
  "organization.send_back",
  "organization.suspend",
  "organization.restore",
  "organization.update",
  "organization.invite",
  "organization.invitation_revoke",
  "organization.claim_approve",
  "organization.claim_decline",
  "organization.member_role",
  "organization.member_remove",
  "solution.approve",
  "solution.send_back",
  "solution.reject",
  "solution.take_down",
  "solution.restore",
  "solution.back",
  "solution.deployment_approve",
  "solution.deployment_reject",
  "solution.enrich",
  "use_case.create",
  "use_case.submit",
  "use_case.draft",
  "use_case.approve",
  "use_case.send_back",
  "use_case.set_programs",
  "introduction.reply",
  "introduction.decline",
  "talent.approve",
  "talent.reject",
  "talent.enquiry_accept",
  "talent.enquiry_decline",
  "talent.enquiry_report",
  "talent.request_changes",
  "talent.remove",
  "talent.restore",
  "talent.delete",
  "proposal.criteria_update",
  "proposal.reviewer_invite",
  "proposal.reviewer_remove",
  "proposal.decide",
  "proposal.release",
  "email.settings_update",
  "email.appearance_update",
  "email.template_update",
  "email.template_reset",
  "email.suppression_add",
  "email.suppression_remove",
  "email.resend",
  "email.test_send",
  "ai.provider_create",
  "ai.provider_update",
  "ai.provider_delete",
  "search.model_change",
  "search.semantic_enable",
  "search.semantic_disable",
  "search.index_rebuild",
  "search.embedding_retry",
  "mcp.app_revoke",
  "mcp.host_add",
  "mcp.host_remove",
  "mcp.other_hosts_allow",
  "mcp.other_hosts_refuse",
  "mcp.user_server_enable",
  "mcp.user_server_disable",
  "mcp.tool_enable",
  "mcp.tool_disable",
] as const;

/**
 * What narrows the audit log and which page of it is shown, as the URL holds it:
 * `?period=&action=&q=&before=&after=`. The page reads these on the server and the toolbar writes
 * them. `before` and `after` are cursors the backend handed out; a change of filter drops them.
 */
export const auditLogSearch = {
  period: parseAsStringLiteral(auditPeriods).withDefault("week"),
  action: parseAsStringLiteral(auditActions),
  q: parseAsString.withDefault(""),
  before: parseAsString,
  after: parseAsString,
};

export const loadAuditLogSearch = createLoader(auditLogSearch);

export type AuditLogSearch = Awaited<ReturnType<typeof loadAuditLogSearch>>;
