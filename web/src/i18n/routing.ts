import { defineRouting } from "next-intl/routing";

// English is the default and carries no prefix, matching GenAI Fund's English-only sites;
// Vietnamese lives under /vi. First visits are matched to the browser language.
export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
