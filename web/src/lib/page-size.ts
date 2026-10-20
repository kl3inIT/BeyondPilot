import { createParser } from "nuqs/server";

/** The most items a page holds; the API refuses more. */
const MAX_PAGE_SIZE = 100;

/** Search's bounded result window; directory browse endpoints have no such page limit. */
export const maxSearchPage = 50;

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

/** A page size a public list offers, as the URL holds it; any other number reads as absent. */
function offeredPageSize(sizes: readonly number[]) {
  return createParser({
    parse(value) {
      const size = Number(value);
      return sizes.includes(size) ? size : null;
    },
    serialize: String,
  });
}

/** `?size=` of a directory of cards: 12, 24 or 48. */
export const gridPageSize = offeredPageSize(gridPageSizes);
