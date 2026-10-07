/** The currencies a use case's budget is written in. */
const currencies = ["USD", "VND"] as const;

type BudgetCurrency = (typeof currencies)[number];

function isCurrency(value: string | null | undefined): value is BudgetCurrency {
  return currencies.includes(value as BudgetCurrency);
}

/**
 * The amounts of a budget as a reader reads them: dollars in full, đồng in millions or billions,
 * the way Vietnamese budgets are said ("200M", "200 triệu"). One amount when the range is a single
 * figure.
 */
function budgetFigures(
  min: number,
  max: number,
  currency: string | null | undefined,
  locale: string,
): { currency: BudgetCurrency; amounts: [string] | [string, string] } {
  const code = isCurrency(currency) ? currency : "USD";
  const format =
    code === "VND"
      ? new Intl.NumberFormat(locale, {
          notation: "compact",
          compactDisplay: locale.startsWith("vi") ? "long" : "short",
          maximumFractionDigits: 1,
        })
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return {
    currency: code,
    amounts: min === max ? [format.format(min)] : [format.format(min), format.format(max)],
  };
}

/** A budget as one line, through the catalog's `single` and `range` messages. */
function budgetText(
  figures: ReturnType<typeof budgetFigures>,
  say: (key: "single" | "range", values: Record<string, string>) => string,
): string {
  const [min, max] = figures.amounts;
  return max === undefined
    ? say("single", { currency: figures.currency, amount: min })
    : say("range", { currency: figures.currency, min, max });
}

export { budgetFigures, budgetText, currencies, isCurrency, type BudgetCurrency };
