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
