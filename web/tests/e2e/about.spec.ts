import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("about page", () => {
  test.use({ locale: "en-US" });

  test("names the team and who funds BeyondPilot", async ({ page }) => {
    await page.goto("/about");

    await expect(
      page.getByRole("heading", { level: 1, name: "The team building BeyondPilot" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Development partner" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funded by GenAI Fund" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nguyễn Đức Anh on LinkedIn" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("is reached from the footer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About BeyondPilot" }).click();

    await expect(page).toHaveURL(/\/about$/);
  });
});
