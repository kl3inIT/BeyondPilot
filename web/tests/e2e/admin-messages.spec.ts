import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const assignments = "/admin/messages/programs";

test.describe("admin chat assignments", () => {
  test.use({ locale: "en-US" });

  test("only operators can manage assignments", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get(assignments, { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe(
      `/sign-in?returnTo=${encodeURIComponent(assignments)}`,
    );

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto(assignments))?.status()).toBe(404);
  });

  test("admin keeps chat assignments without reported-message access", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    expect((await page.request.get("/api/messaging/admin/reported")).status()).toBe(404);
    expect((await page.goto("/admin/messages/reported"))?.status()).toBe(404);
    if (isMobile) {
      await page.goto(assignments);
    } else {
      await page.goto("/admin");
      const navigation = page.getByRole("navigation", { name: "Admin navigation" });
      await expect(navigation.getByRole("link", { name: "Reported messages" })).toHaveCount(0);
      await navigation.getByRole("link", { name: "Chat assignments" }).click();
    }

    await expect(page).toHaveURL(assignments);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chat assignments");
    await expect(page.getByRole("table")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Assign", exact: true })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
