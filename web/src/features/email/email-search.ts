import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** How far back the log looks; `week` is the default and `all` has no bound. */
export const emailPeriods = ["day", "week", "month", "all"] as const;

/** The states of an email, as the backend publishes them. */
export const emailStatuses = [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "skipped",
] as const;

/** Every kind of email, in the order the screens group them. */
export const emailKinds = [
  "sign_in_code",
  "consent_withdrawn",
  "organization_invitation",
  "organization_approved",
  "organization_refused",
  "organization_sent_back",
  "organization_request_approved",
  "organization_request_declined",
  "organization_taken_down",
  "organization_restored",
  "organization_merged",
  "application_received",
  "reviewer_invitation",
  "application_outcome",
  "solution_approved",
  "solution_sent_back",
  "solution_rejected",
  "solution_taken_down",
  "solution_restored",
  "perk_request_waiting",
  "perk_request_granted",
  "perk_request_declined",
  "use_case_approved",
  "use_case_sent_back",
  "proposal_sent",
  "proposal_shortlisted",
  "proposal_declined",
  "matching_invitation",
  "talent_approved",
  "talent_changes_requested",
  "talent_removed",
  "talent_restored",
  "message_request",
  "message_request_reminder",
  "message_request_accepted",
  "message_request_declined",
  "message_request_closed",
  "message_unread",
] as const;

export type EmailKind = (typeof emailKinds)[number];

/** Why an address is suppressed. */
export const suppressionReasons = ["bounce", "complaint", "manual"] as const;

/**
 * What narrows the email log and which page of it is shown, as the URL holds it:
 * `?period=&kind=&status=&q=&before=&after=`. `before` and `after` are cursors the backend handed
 * out; a change of filter drops them.
 */
export const emailActivitySearch = {
  period: parseAsStringLiteral(emailPeriods).withDefault("week"),
  kind: parseAsStringLiteral(emailKinds),
  status: parseAsStringLiteral(emailStatuses),
  q: parseAsString.withDefault(""),
  before: parseAsString,
  after: parseAsString,
  size: pageSize,
};

export const loadEmailActivitySearch = createLoader(emailActivitySearch);

export type EmailActivitySearch = Awaited<ReturnType<typeof loadEmailActivitySearch>>;

/** The columns the list sorts by, as its API names them. */
export const emailSuppressionSortKeys = ["address", "since"] as const;

/** What narrows the suppressed addresses and which page is shown: `?reason=&q=&page=`. */
export const emailSuppressionsSearch = {
  reason: parseAsStringLiteral(suppressionReasons),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: pageSize,
};

export const loadEmailSuppressionsSearch = createLoader(emailSuppressionsSearch);

export type EmailSuppressionsSearch = Awaited<ReturnType<typeof loadEmailSuppressionsSearch>>;
