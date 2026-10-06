import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("use cases", () => {
  test.use({ locale: "en-US" });

  test("lists the published use cases with their organization, budget and deadline", async ({
    page,
  }) => {
    await page.goto("/use-cases");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Use cases");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      "Voice assistant for vehicle owners",
      "Claims triage with document intelligence",
      "Demand forecasting for a retail chain",
      "Have a business problem AI could solve?",
    ]);
    const first = page.getByRole("listitem").filter({ hasText: "Pocket Policy" });
    await expect(first.getByText("USD 15,000–40,000")).toBeVisible();
    await expect(first.getByText("Apply by Dec 31, 2026")).toBeVisible();
    await expect(first.getByText("23:59 ICT")).toBeVisible();
    await expect(page.getByText("3 use cases")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("an organization that stays anonymous and a budget to decide read as such", async ({
    page,
  }) => {
    await page.goto("/use-cases");

    const triage = page.getByRole("listitem").filter({ hasText: "Claims triage" });
    await expect(triage.getByText("To be determined")).toBeVisible();
    const forecasting = page.getByRole("listitem").filter({ hasText: "Demand forecasting" });
    await expect(forecasting.getByText("Organization not named")).toBeVisible();
    await expect(forecasting.getByText("Shown to members")).toBeVisible();
  });

  test("an industry and a search narrow the list through the address", async ({ page }) => {
    await page.goto("/use-cases");

    await page.getByRole("button", { name: "Insurance" }).click();
    await expect(page).toHaveURL("/use-cases?industry=insurance");
    await expect(page.getByRole("button", { name: "Insurance" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("1 use case", { exact: true })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search use cases" }).fill("voice");
    await expect(page).toHaveURL(/\/use-cases\?(?=.*q=voice)(?=.*industry=insurance)/);
    await expect(page.getByText("No use cases match")).toBeVisible();

    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL("/use-cases");
    await expect(page.getByText("3 use cases")).toBeVisible();
  });

  test("the order follows the address", async ({ page }) => {
    await page.goto("/use-cases?sort=deadline");

    await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toHaveText(
      "Claims triage with document intelligence",
    );
  });

  test("reads in Vietnamese under /vi", async ({ page }) => {
    await page.goto("/vi/use-cases");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bài toán");
    await expect(page.getByText("3 bài toán")).toBeVisible();
  });
});

test.describe("use cases on a phone", () => {
  test.use({ locale: "en-US", viewport: { width: 390, height: 844 } });

  test("nothing runs past the screen edge", async ({ page }) => {
    await page.goto("/use-cases");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expectNoSeriousA11yViolations(page);
  });
});
