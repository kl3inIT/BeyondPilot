import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("admin", () => {
  test.use({ locale: "en-US" });

  for (const { path, signIn } of [
    { path: "/admin", signIn: "/sign-in?returnTo=%2Fadmin" },
    { path: "/vi/admin", signIn: "/vi/sign-in?returnTo=%2Fvi%2Fadmin" },
  ]) {
    test(`a visitor to ${path} is sent to sign in and back`, async ({ page }) => {
      // The answer itself redirects: nothing of the page is sent to someone who is not signed in.
      const answer = await page.request.get(path, { maxRedirects: 0 });
      expect(answer.status()).toBe(307);
      expect(answer.headers()["location"]).toBe(signIn);

      await page.goto(path);
      await expect(page).toHaveURL(signIn);
    });
  }

  test("an account that is not an operator gets the page any unknown address gets", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);

    const answer = await page.goto("/admin");
    expect(answer?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    const refused = await page.locator("body").innerText();

    await page.goto("/no-such-page");
    await expect(page.locator("body")).toHaveText(refused, { useInnerText: true });
  });

  test("an operator opens the admin area, which search engines are told to skip", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);

    const answer = await page.goto("/admin");
    expect(answer?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoSeriousA11yViolations(page);
  });
});
