import { useFormatter as useIntlFormatter, useLocale } from "next-intl";
import { useMemo } from "react";

import { withAppDates } from "./formats";

/**
 * next-intl's formatter with dates written the app's way (docs/conventions.md › Internationalization):
 * day before month in English too, the 24-hour clock, Vietnam time. Every component formats through
 * this one; next-intl's own `useFormatter` would write an English date the American way.
 */
function useFormatter() {
  const base = useIntlFormatter();
  const locale = useLocale();

  return useMemo(() => withAppDates(base, locale), [base, locale]);
}

export { useFormatter };
