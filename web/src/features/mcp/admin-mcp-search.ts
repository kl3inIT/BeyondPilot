import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

/** How far back the activity looks; `week` is the default, and calls are kept 90 days. */
export const mcpPeriods = ["day", "week", "month", "all"] as const;

export const mcpOutcomes = ["ok", "refused", "failed"] as const;

/**
 * What narrows Admin › AI › MCP › Activity, as the URL holds it:
 * `?q=&period=&app=&tool=&outcome=&page=`. The page reads these on the server and the toolbar
 * writes them. A value at its default is left out of the URL.
 */
export const mcpActivitySearch = {
  q: parseAsString.withDefault(""),
  period: parseAsStringLiteral(mcpPeriods).withDefault("week"),
  app: parseAsString,
  tool: parseAsString,
  outcome: parseAsStringLiteral(mcpOutcomes),
  page: parseAsInteger.withDefault(1),
};

export const loadMcpActivitySearch = createLoader(mcpActivitySearch);

export type McpActivitySearch = Awaited<ReturnType<typeof loadMcpActivitySearch>>;
