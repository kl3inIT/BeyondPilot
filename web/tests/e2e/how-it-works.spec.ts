import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("how it works page", () => {
  test.use({ locale: "en-US" });

  test("explains the steps, the challenge example and the paths", async ({ page }) => {
    await page.goto("/how-it-works");

    await expect(
      page.getByRole("heading", { level: 1, name: "From a question to your next step." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Describe it, discover it, act on it." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How the AI for Insurance Challenge runs on BeyondPilot" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who it is for" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the brief" })).toHaveAttribute(
      "href",
      "https://beyondpilot.genaifund.ai/insurance-ai-tasco",
    );
  });

  test("is reached from the header and the home page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "How It Works" }).first().click();

    await expect(page).toHaveURL(/\/how-it-works$/);
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/how-it-works");

    await expectNoSeriousA11yViolations(page);
  });
});
