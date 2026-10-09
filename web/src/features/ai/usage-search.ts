import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

/** What the page covers: today, or the last 7 or 30 days with today, in Vietnam time. */
export const usagePeriods = ["today", "7d", "30d"] as const;

/** What the Overview's table groups the calls by. */
export const usageGroupings = ["model", "task", "provider"] as const;

export const usageOutcomes = ["ok", "failed"] as const;

const period = parseAsStringLiteral(usagePeriods).withDefault("today");

/**
 * What the Overview of Admin › AI › Usage shows, as the URL holds it: `?period=&by=`. The page
 * reads these on the server and the switches write them. A value at its default is left out.
 */
export const usageOverviewSearch = {
  period,
  by: parseAsStringLiteral(usageGroupings).withDefault("model"),
};

/** What narrows the Calls log: `?period=&task=&provider=&model=&outcome=&page=`. */
export const usageCallsSearch = {
  period,
  task: parseAsString,
  provider: parseAsString,
  model: parseAsString,
  outcome: parseAsStringLiteral(usageOutcomes),
  page: parseAsInteger.withDefault(1),
};

export const loadUsageOverviewSearch = createLoader(usageOverviewSearch);

export const loadUsageCallsSearch = createLoader(usageCallsSearch);

/** The address of the Overview or of the log with what it shows written into it. */
export const usageOverviewAddress = createSerializer(usageOverviewSearch);

export const usageCallsAddress = createSerializer(usageCallsSearch);

export type UsagePeriod = (typeof usagePeriods)[number];

export type UsageOverviewSearch = Awaited<ReturnType<typeof loadUsageOverviewSearch>>;

export type UsageCallsSearch = Awaited<ReturnType<typeof loadUsageCallsSearch>>;
