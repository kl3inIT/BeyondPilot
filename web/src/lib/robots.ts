import { siteOrigin } from "@/lib/site";

/** Areas behind sign-in, and Spring's own paths, which no crawler needs. */
const privatePaths = ["/admin", "/vi/admin", "/api/"];

/**
 * robots.txt for the host that asked. Only the public address is open to crawlers; any other host
 * (staging, a local run) serves the same pages and is closed so nothing is indexed twice. The
 * Content Signals line (contentsignals.org) welcomes search, answers and training alike: the pages
 * are public and BeyondPilot wants to be known to people and to the models they ask.
 */
function robotsTxt(host: string | null): string {
  if (host !== new URL(siteOrigin).host) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    ...privatePaths.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${siteOrigin}/sitemap.xml`,
    "",
  ].join("\n");
}

export { robotsTxt };
