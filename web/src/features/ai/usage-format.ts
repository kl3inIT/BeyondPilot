/** The part of the app's formatter these rules need (`src/i18n/format.ts`, `format-server.ts`). */
type NumberFormatter = {
  number: (
    value: number,
    options?: {
      notation?: "compact";
      style?: "currency";
      currency?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    },
  ) => string;
};

/**
 * How the numbers of AI usage are rounded, one rule for each kind, so the log of calls reads as the
 * totals above it do. The rules are those of the overview's totals.
 */
function usageNumbers(format: NumberFormatter) {
  return {
    /** A count of tokens, shortened past a thousand to two decimals at most: "512", "5.21K", "2.17M". */
    tokens: (value: number) =>
      format.number(value, { notation: "compact", maximumFractionDigits: 2 }),
    /**
     * An estimated cost in US dollars: cents for a dollar or more, and up to four decimals below
     * one, where a single call costs a fraction of a cent.
     */
    cost: (value: number) =>
      format.number(value, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: value < 1 ? 4 : 2,
      }),
    /** A duration in seconds, to a tenth; the caller adds the unit. */
    seconds: (milliseconds: number) =>
      format.number(milliseconds / 1000, { maximumFractionDigits: 1 }),
  };
}

export { usageNumbers };
