import { siteOrigin } from "@/lib/site";

/** Crawlers that collect text to train models; the site reads `ai-train=no`, so they stay out. */
const trainingCrawlers = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
];

/** Agents that fetch a page to answer a person's question or cite it in search. */
const answerAgents = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

/** Areas behind sign-in, and Spring's own paths, which no crawler needs. */
const privatePaths = ["/admin", "/vi/admin", "/api/"];

/**
 * robots.txt for the host that asked. Only the public address is open to crawlers; any other host
 * (staging, a local run) serves the same pages and is closed so nothing is indexed twice. The
 * Content Signals line (contentsignals.org) lets search and answers use the pages, not training.
 */
function robotsTxt(host: string | null): string {
  if (host !== new URL(siteOrigin).host) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  const disallow = privatePaths.map((path) => `Disallow: ${path}`);
  return [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    ...disallow,
    "",
    ...answerAgents.map((agent) => `User-agent: ${agent}`),
    "Allow: /",
    ...disallow,
    "",
    ...trainingCrawlers.map((agent) => `User-agent: ${agent}`),
    "Disallow: /",
    "",
    `Sitemap: ${siteOrigin}/sitemap.xml`,
    "",
  ].join("\n");
}

export { robotsTxt };
