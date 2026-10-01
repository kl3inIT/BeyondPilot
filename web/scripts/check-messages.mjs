// Fails when the English and Vietnamese message catalogs do not have exactly the same keys.
import { readFileSync } from "node:fs";

const locales = ["en", "vi"];

function keysOf(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child !== null && typeof child === "object" ? keysOf(child, path) : [path];
  });
}

const catalogs = Object.fromEntries(
  locales.map((locale) => [
    locale,
    new Set(
      keysOf(
        JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
      ),
    ),
  ]),
);

let missing = 0;
for (const locale of locales) {
  for (const other of locales) {
    for (const key of catalogs[other]) {
      if (!catalogs[locale].has(key)) {
        console.error(`messages/${locale}.json is missing "${key}" (present in ${other}.json)`);
        missing += 1;
      }
    }
  }
}

if (missing > 0) {
  process.exit(1);
}
console.log(`Message catalogs match (${catalogs.en.size} keys).`);
