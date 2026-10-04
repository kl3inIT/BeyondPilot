import type { BrowserContext } from "@playwright/test";

// The web server reads the session by asking the stub backend of this run; the cookie's value picks
// the account it answers with (tests/e2e/stub-backend.mjs).
export async function signInAs(
  context: BrowserContext,
  account: "operator" | "unnamed",
  baseURL: string,
) {
  await context.addCookies([{ name: "BEYONDPILOT_SESSION", value: account, url: baseURL }]);
}
