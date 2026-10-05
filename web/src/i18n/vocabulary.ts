import { useTranslations, type Messages } from "next-intl";

type VocabularyName = keyof Messages["Vocabulary"];

/**
 * The words for the codes of one vocabulary, such as an industry or a maturity. The backend sends
 * codes as plain strings, so the key is not checked here; a code this catalog does not know yet is
 * shown as it came.
 */
function useVocabulary(name: VocabularyName): (code: string) => string {
  const t = useTranslations(`Vocabulary.${name}`) as unknown as {
    (code: string): string;
    has: (code: string) => boolean;
  };
  return (code) => (t.has(code) ? t(code) : code);
}

/** The countries a profile may name, by ISO 3166-1 alpha-2 code; the region first. */
const countryCodes = [
  "VN",
  "SG",
  "TH",
  "MY",
  "ID",
  "PH",
  "JP",
  "KR",
  "CN",
  "HK",
  "TW",
  "IN",
  "AU",
  "AE",
  "US",
  "CA",
  "GB",
  "DE",
  "FR",
  "NL",
] as const;

/**
 * The name of a country in the reader's language. The names are in the catalog, not asked of
 * `Intl.DisplayNames`: the server and the browser carry different data for it, and a name that
 * differs between them breaks hydration.
 */
function useCountryName(): (code: string) => string {
  return useVocabulary("country");
}

export { countryCodes, useCountryName, useVocabulary };
