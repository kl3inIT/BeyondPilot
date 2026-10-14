import { listAuditEvents, type AuditEventList } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AuditLogSearch } from "./audit-log-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

const DAY = 24 * 60 * 60 * 1000;

const periodLength = { day: DAY, week: 7 * DAY, month: 30 * DAY, all: null };

/**
 * What narrows the audit log, as the log and its download both send it. The backend knows instants,
 * not periods, so the period becomes the instant it starts at.
 */
export function auditLogFilters(search: AuditLogSearch) {
  const length = periodLength[search.period];
  return {
    from: length === null ? undefined : new Date(Date.now() - length).toISOString(),
    action: search.action ?? undefined,
    q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
  };
}

/**
 * One page of the audit log for the operator behind this request. Server only. The backend knows
 * instants, not periods, so the period becomes the instant it starts at.
 */
export async function readAuditLog(search: AuditLogSearch): Promise<AuditEventList> {
  const { data } = await listAuditEvents({
    ...(await sessionRequest()),
    query: {
      ...auditLogFilters(search),
      before: search.before ?? undefined,
      after: search.after ?? undefined,
      size: search.size ?? undefined,
    },
  });
  return data;
}
