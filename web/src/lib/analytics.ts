/**
 * The first segment of every address Google Analytics may measure, without a locale prefix. A page
 * outside this list is not measured, so a new area stays private until someone decides otherwise.
 */
const trackedSections = [
  "how-it-works",
  "about",
  "programs",
  "use-cases",
  "solutions",
  "organizations",
  "talent",
  "search",
  "privacy",
  "terms",
  "get-started",
  "founders",
] as const;

/**
 * Pages inside a measured section that stay private: the ones a person signs in to see (applying
 * to a program, a proposal to a use case and what follows it) and a solution's unlisted link,
 * whose address is its key.
 */
const privatePages = [
  /^\/programs\/[^/]+\/apply(\/|$)/,
  /^\/use-cases\/[^/]+\/propose(\/|$)/,
  /^\/solutions\/shared(\/|$)/,
];

/** Whether the page at `pathname`, written without a locale prefix, may be measured. */
function isTrackedPath(pathname: string): boolean {
  const section = pathname.split("/")[1];
  const listed = section === "" || trackedSections.some((tracked) => tracked === section);

  return listed && !privatePages.some((page) => page.test(pathname));
}

export { isTrackedPath, trackedSections };
