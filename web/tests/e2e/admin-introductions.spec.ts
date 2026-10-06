import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("admin introductions", () => {
  test.use({ locale: "en-US" });

  test("an operator reads the requests in full, and sees which wait too long", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/introductions");

    await expect(page.getByRole("heading", { level: 1, name: "Introductions" })).toBeVisible();
    await expect(
      page.getByText("1 request has waited more than 3 days for an answer."),
    ).toBeVisible();
    await expect(page.getByText("Lumen Health → Pocket Policy")).toBeVisible();
    // The message is shown whole; the sender's address is shown nowhere.
    await expect(page.getByText("Can you run it in Vietnamese?")).toBeVisible();
    await expect(page.getByText("Hà Lê · Lumen Health")).toBeVisible();
    await expect(page.getByText("Someone at Mekong Life")).toBeVisible();
    await expect(page.getByText("Waiting over 3 days")).toHaveCount(1);
    await expect(page.getByRole("main").getByText("@")).toHaveCount(0);
    await expect(page.getByText("3 requests")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("the state and the search narrow the list, and nothing found is said", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/introductions");

    await page.getByRole("link", { name: "Replied" }).click();
    await expect(page).toHaveURL(/status=replied/);
    await expect(page.getByText("Do you coach agents in Vietnamese?")).toBeVisible();
    await expect(page.getByText("3 requests")).toHaveCount(0);

    await page.goto("/admin/introductions?q=nothing");
    await expect(page.getByText("No request matches", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL("/admin/introductions");
  });

  test("anyone but an operator finds nothing there", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);

    expect((await page.goto("/admin/introductions"))?.status()).toBe(404);
  });
});
