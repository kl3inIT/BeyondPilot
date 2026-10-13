import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const reported = "/admin/messages/reported";

test.describe("admin reported messages", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator reads what was reported", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get(reported, { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(reported)}`);

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto(reported))?.status()).toBe(404);
  });

  test("operators read the reported first messages with who sent them and about what", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    if (isMobile) {
      // Below 768px the sidebar is a sheet; the address is opened as a link to it would.
      await page.goto(reported);
    } else {
      await page.goto("/admin");
      await page
        .getByRole("navigation", { name: "Admin navigation" })
        .getByRole("link", { name: "Reported messages" })
        .click();
    }

    await expect(page).toHaveURL(reported);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reported messages");
    // A table at every width: on a phone it scrolls sideways.
    await expect(page.getByRole("table")).toHaveCount(1);
    const rows = page.getByRole("row");
    const spam = rows.filter({ hasText: "Buy ten thousand followers for your profile." });
    await expect(spam).toContainText("growth@spam.example");
    await expect(spam).toContainText("No organization");
    await expect(spam).toContainText("Siti Rahma");
    await expect(spam).toContainText("AI talent");
    await expect(spam).toContainText("4 Oct 2026");
    // A sender whose account no longer signs in has no address to show.
    const leads = rows.filter({ hasText: "Cheap leads for your sales team." });
    await expect(leads).toContainText("Quang Vũ");
    await expect(leads).toContainText("Account no longer signs in");
    await expect(leads).toContainText("First Call");
    await expect(leads).toContainText("Policy Chat");
    await expect(page.getByText("2 reported messages")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
