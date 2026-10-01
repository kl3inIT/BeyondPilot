import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Deadlines and schedules are defined in Vietnam time (ICT), whoever is reading.
    timeZone: "Asia/Ho_Chi_Minh",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
