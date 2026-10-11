import { createParser } from "nuqs/server";

/** The most items a page holds; the API refuses more. */
const MAX_PAGE_SIZE = 100;

/** The page sizes a table offers. */
export const tablePageSizes = [10, 25, 50, 100] as const;

/** The page sizes a directory of cards offers: full rows of two, three and four columns. */
export const gridPageSizes = [12, 24, 48] as const;

/**
 * How many items a page holds, as the URL holds it: `?size=`. Absent, the list keeps its own page
 * size; a value the API would refuse reads as absent.
 */
export const pageSize = createParser({
  parse(value) {
    const size = Number(value);
    return Number.isInteger(size) && size >= 1 && size <= MAX_PAGE_SIZE ? size : null;
  },
  serialize: String,
});
