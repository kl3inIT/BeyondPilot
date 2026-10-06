import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

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
  "organization_invitation",
  "organization_approved",
  "organization_refused",
  "organization_request_approved",
  "organization_request_declined",
  "organization_taken_down",
  "organization_restored",
  "application_received",
  "reviewer_invitation",
  "application_outcome",
  "introduction_request",
  "introduction_made",
  "introduction_declined",
  "talent_approved",
  "talent_changes_requested",
  "talent_removed",
  "talent_enquiry",
  "talent_enquiry_reminder",
  "talent_introduction",
  "talent_enquiry_declined",
  "talent_enquiry_closed",
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
};

export const loadEmailActivitySearch = createLoader(emailActivitySearch);

export type EmailActivitySearch = Awaited<ReturnType<typeof loadEmailActivitySearch>>;

/** What narrows the suppressed addresses and which page is shown: `?reason=&q=&page=`. */
export const emailSuppressionsSearch = {
  reason: parseAsStringLiteral(suppressionReasons),
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const loadEmailSuppressionsSearch = createLoader(emailSuppressionsSearch);

export type EmailSuppressionsSearch = Awaited<ReturnType<typeof loadEmailSuppressionsSearch>>;
