import { defineRouting } from "next-intl/routing";

// English is the default and carries no prefix, matching GenAI Fund's English-only sites;
// Vietnamese lives under /vi. The site opens in English for everyone: a person reads Vietnamese
// after choosing it in the language menu or opening a /vi address, and next-intl's locale cookie
// keeps that choice for the addresses without a prefix until the browser is closed. The browser's
// language is never asked; src/proxy.ts takes it out of the request before locale routing.
export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
