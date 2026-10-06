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

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** What was typed as an email domain, as the backend takes it: lowercase, without the at sign. */
export function domainOf(text: string): string {
  return text.trim().toLowerCase().replace(/^@/, "");
}

/** Whether the text names a domain such as "example.com". */
export function isDomain(text: string): boolean {
  return text.length <= 253 && DOMAIN.test(text);
}
