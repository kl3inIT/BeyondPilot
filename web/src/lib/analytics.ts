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
 * Pages inside a measured section that stay private: a solution's unlisted link, whose address is
 * its key, and a person's own proposal to a use case.
 */
const privatePages = [/^\/solutions\/shared(\/|$)/, /^\/use-cases\/[^/]+\/propose\/view$/];

/** Whether the page at `pathname`, written without a locale prefix, may be measured. */
function isTrackedPath(pathname: string): boolean {
  const section = pathname.split("/")[1];
  const listed = section === "" || trackedSections.some((tracked) => tracked === section);

  return listed && !privatePages.some((page) => page.test(pathname));
}

export { isTrackedPath, trackedSections };
