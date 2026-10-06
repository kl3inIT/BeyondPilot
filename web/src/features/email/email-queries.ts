import { notFound } from "next/navigation";

import {
  getEmailMessage,
  getEmailSettings,
  getEmailTemplate,
  listEmailMessages,
  listEmailSuppressions,
  listEmailTemplates,
  type EmailMessage,
  type EmailMessageList,
  type EmailSettings,
  type EmailSuppressionList,
  type EmailTemplate,
  type EmailTemplateList,
} from "@/lib/api/generated";
import { ApiError } from "@/lib/api/client";
import { sessionRequest } from "@/lib/auth/session";

import type { EmailActivitySearch, EmailSuppressionsSearch } from "./email-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

const DAY = 24 * 60 * 60 * 1000;

const periodLength = { day: DAY, week: 7 * DAY, month: 30 * DAY, all: null };

/**
 * A read the backend refused: a caller who is no longer an operator, or an address that names no
 * email or kind, shows the not-found page. A cursor a person edited by hand is refused too.
 */
function notFoundWhenRefused(error: unknown): never {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status ?? 0)) {
    notFound();
  }
  throw error;
}

/** The email settings, without their secrets. Server only. */
export async function readEmailSettings(): Promise<EmailSettings> {
  const { data } = await getEmailSettings({ ...(await sessionRequest()) }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/** Every kind of email operators word. Server only. */
export async function readEmailTemplates(): Promise<EmailTemplateList> {
  const { data } = await listEmailTemplates({ ...(await sessionRequest()) }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/** One kind's wording, its default and its variables. Server only. */
export async function readEmailTemplate(kind: string): Promise<EmailTemplate> {
  const { data } = await getEmailTemplate({ ...(await sessionRequest()), path: { kind } }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/**
 * One page of the email log with the counts of its period. Server only. The backend knows instants,
 * not periods, so the period becomes the instant it starts at.
 */
export async function readEmailActivity(search: EmailActivitySearch): Promise<EmailMessageList> {
  const length = periodLength[search.period];
  const { data } = await listEmailMessages({
    ...(await sessionRequest()),
    query: {
      from: length === null ? undefined : new Date(Date.now() - length).toISOString(),
      kind: search.kind ?? undefined,
      status: search.status ?? undefined,
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      before: search.before ?? undefined,
      after: search.after ?? undefined,
    },
  }).catch(notFoundWhenRefused);
  return data;
}

/** One email as it was sent, with what happened to it. Server only. */
export async function readEmailMessage(id: string): Promise<EmailMessage> {
  const { data } = await getEmailMessage({ ...(await sessionRequest()), path: { id } }).catch(
    notFoundWhenRefused,
  );
  return data;
}

/** One page of suppressed addresses. Server only. */
export async function readEmailSuppressions(
  search: EmailSuppressionsSearch,
): Promise<EmailSuppressionList> {
  const { data } = await listEmailSuppressions({
    ...(await sessionRequest()),
    query: {
      reason: search.reason ?? undefined,
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      page: search.page,
    },
  }).catch(notFoundWhenRefused);
  return data;
}
