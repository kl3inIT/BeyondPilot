import { expect, type BrowserContext, type Page } from "@playwright/test";

// The web server reads the session by asking the stub backend of this run; the cookie's value picks
// the account it answers with (tests/e2e/stub-backend.mjs).
export async function signInAs(
  context: BrowserContext,
  account: "operator" | "unnamed",
  baseURL: string,
) {
  await context.addCookies([{ name: "BEYONDPILOT_SESSION", value: account, url: baseURL }]);
}

/** Answers the sign-out request; a 204 also ends the session, as the backend would. */
export async function answerSignOut(page: Page, status: number) {
  const requests: string[] = [];
  await page.route("**/logout", async (route) => {
    requests.push(route.request().method());
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    if (status === 204) {
      await page.context().clearCookies();
    }
    await route.fulfill({ status });
  });
  return requests;
}
