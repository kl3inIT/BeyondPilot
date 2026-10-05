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
