import { listAuditEvents, type AuditEventList } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import { getTranslations } from "next-intl/server";

import { actionsMatching, type AuditAction, type AuditLogSearch } from "./audit-log-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

const DAY = 24 * 60 * 60 * 1000;

const periodLength = { day: DAY, week: 7 * DAY, month: 30 * DAY, all: null };

/**
 * What narrows the audit log, as the log and its download both send it. The backend knows instants,
 * not periods, so the period becomes the instant it starts at.
 */
export function auditLogFilters(search: AuditLogSearch, named: AuditAction[]) {
  const length = periodLength[search.period];
  return {
    from: length === null ? undefined : new Date(Date.now() - length).toISOString(),
    action: search.action ?? undefined,
    q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
    actions: named.length === 0 ? undefined : named,
  };
}

/**
 * The actions whose names, in the reader's language, hold the words searched for. Server only. An
 * event of one of them matches the search as well as one whose people or record match it.
 */
export async function actionsNamed(search: AuditLogSearch): Promise<AuditAction[]> {
  const t = await getTranslations("Admin.auditLog");
  return actionsMatching(search.q, (action) => [
    t(`action.${action}`),
    // The sentence of an action names what it was done to as a tag, which is not searched for.
    t.raw(`activity.${action}`).replace(/<[^>]*>/g, ""),
  ]);
}

/**
 * One page of the audit log for the operator behind this request. Server only. The backend knows
 * instants, not periods, so the period becomes the instant it starts at.
 */
export async function readAuditLog(
  search: AuditLogSearch,
  named: AuditAction[],
): Promise<AuditEventList> {
  const { data } = await listAuditEvents({
    ...(await sessionRequest()),
    query: {
      ...auditLogFilters(search, named),
      before: search.before ?? undefined,
      after: search.after ?? undefined,
      size: search.size ?? undefined,
    },
  });
  return data;
}
