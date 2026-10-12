import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { formats, timeZone } from "./formats";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    timeZone,
    formats,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
