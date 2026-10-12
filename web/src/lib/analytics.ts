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

/**
 * What a link to an apply or propose page leads to, as the parameters of the `apply_click` event:
 * the kind of page and the program's slug or the use case's id. `pathname` may carry a locale prefix.
 */
function applyTarget(pathname: string): { content_type: string; item_id: string } | null {
  const match = /^(?:\/[a-z]{2})?\/(programs|use-cases)\/([^/]+)\/(?:apply|propose)\/?$/.exec(
    pathname,
  );

  return match
    ? { content_type: match[1] === "programs" ? "program" : "use_case", item_id: match[2] }
    : null;
}

export { applyTarget, isTrackedPath, trackedSections };
