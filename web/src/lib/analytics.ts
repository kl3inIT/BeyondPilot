/**
 * The areas Google Analytics never measures, without a locale prefix: every page behind sign-in,
 * the sign-in and consent screens, and a solution's unlisted link, whose address is its key. Their
 * addresses and titles carry application, organization and account details that stay with us.
 * This file imports nothing, so `next.config.ts` can read it.
 */
const untrackedPaths = [
  "/admin",
  "/workspace",
  "/reviews",
  "/account",
  "/applications",
  "/oauth-consent",
  "/sign-in",
  "/solutions/shared",
] as const;

/** Whether the page at `pathname`, written without a locale prefix, may be measured. */
function isTrackedPath(pathname: string): boolean {
  return !untrackedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export { isTrackedPath, untrackedPaths };
