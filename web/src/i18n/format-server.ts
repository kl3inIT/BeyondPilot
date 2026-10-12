import { getFormatter as getIntlFormatter, getLocale } from "next-intl/server";

import { withAppDates } from "./formats";

/** `useFormatter` of `./format` for an async Server Component: the same dates, read with `await`. */
async function getFormatter() {
  const [base, locale] = await Promise.all([getIntlFormatter(), getLocale()]);
  return withAppDates(base, locale);
}

export { getFormatter };
