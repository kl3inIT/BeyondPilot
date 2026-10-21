/** The host of a website as people say it, "revve.ai" for "https://www.revve.ai/about"; `null` when it cannot be read. */
export function websiteHost(website: string | null | undefined): string | null {
  if (!website) {
    return null;
  }
  try {
    return new URL(website).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Whether an organization is not taken down, so it can invite members and publish. */
export function isActive(organization: { status: string; suspendedAt?: string | null }): boolean {
  return organization.status === "active" && !organization.suspendedAt;
}

/** The longest description the backend takes. */
export const MAX_DESCRIPTION = 280;
/** The most industries the backend takes. */
export const MAX_INDUSTRIES = 5;
/** The earliest year the backend takes for when an organization started. */
const FIRST_YEAR = 1800;

/**
 * The year written in the field when it is one the backend takes, from 1800 to this year; otherwise
 * null.
 */
export function yearOf(text: string, thisYear = new Date().getFullYear()): number | null {
  const year = Number(text);
  return /^\d{4}$/.test(text.trim()) && year >= FIRST_YEAR && year <= thisYear ? year : null;
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** What was typed as an email domain, as the backend takes it: lowercase, without the at sign. */
export function domainOf(text: string): string {
  return text.trim().toLowerCase().replace(/^@/, "");
}

/** Whether the text names a domain such as "example.com". */
export function isDomain(text: string): boolean {
  return text.length <= 253 && DOMAIN.test(text);
}

/** Limit on legacy organization background data retained for historical API compatibility. */
export const MAX_TEAM_BACKGROUND = 2000;
