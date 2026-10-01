import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("home page", () => {
  test.use({ locale: "en-US" });

  test("shows the live campaign, the sections and the footer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /AI for Insurance/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "One platform for every program." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions and answers" })).toBeVisible();
    await expect(page.getByText("Anyone with a solution")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a planned page renders the coming-soon screen", async ({ page }) => {
    await page.goto("/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coming soon");
  });
});

test.describe("home page on a phone", () => {
  test.use({ locale: "en-US", viewport: { width: 390, height: 844 } });

  test("opens the menu from the menu button", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /AI talent/ })).toBeVisible();
  });
});
