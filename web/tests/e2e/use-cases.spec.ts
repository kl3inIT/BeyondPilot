import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { serveStoredImages } from "./stored-files";

test.describe("use cases", () => {
  test.use({ locale: "en-US" });

  test("lists the published use cases with their organization, budget and deadline", async ({
    page,
  }) => {
    await serveStoredImages(page);
    await page.goto("/use-cases");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Use cases");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      "Voice assistant for vehicle owners",
      "Claims triage with document intelligence",
      "Demand forecasting for a retail chain",
      "Have a business problem AI could solve?",
    ]);
    const first = page.getByRole("listitem").filter({ hasText: "Pocket Policy" });
    await expect(first.locator("img")).toHaveCount(1);
    const withoutLogo = page.getByRole("listitem").filter({ hasText: "Lumen Health" });
    await expect(withoutLogo.getByText("LH", { exact: true })).toBeVisible();
    await expect(first.getByText("USD 15,000–40,000")).toBeVisible();
    await expect(first.getByText("Apply by Dec 31, 2026")).toBeVisible();
    await expect(first.getByText("23:59 ICT")).toBeVisible();
    await expect(page.getByText("3 use cases")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("opens a published use case's complete public brief", async ({ page }) => {
    await page.goto("/use-cases");
    await page.getByRole("link", { name: "View use case" }).first().click();

    await expect(page).toHaveURL(/\/use-cases\/0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0001$/);
    await expect(page).toHaveTitle("Voice assistant for vehicle owners · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Voice assistant for vehicle owners",
    );
    await expect(page.getByRole("heading", { name: "Problem statement" })).toBeVisible();
    await expect(
      page.getByText("The team needs a clear, measurable way to improve this work."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open for proposals" })).toBeVisible();
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
    await expect(forecasting.getByText("ON", { exact: true })).toBeVisible();
    await expect(forecasting.getByText("Shown to members")).toBeVisible();
  });

  test("industries narrow the list through a multi-select field and the address", async ({
    page,
  }) => {
    await page.goto("/use-cases");

    const industry = page.getByRole("combobox", { name: "Industry" });
    await industry.fill("Insurance");
    await page.getByRole("option", { name: "Insurance" }).click();
    await industry.click();
    await industry.fill("Automotive");
    await page.getByRole("option", { name: "Automotive and mobility" }).click();
    await expect(page).toHaveURL(/\/use-cases\?industry=insurance,automotive_mobility$/);
    await expect(page.getByText("2 use cases", { exact: true })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search use cases" }).fill("retail");
    await expect(page).toHaveURL(
      /\/use-cases\?(?=.*q=retail)(?=.*industry=insurance,automotive_mobility)/,
    );
    await expect(page.getByText("No use cases match")).toBeVisible();

    // The way back is a plain link to the list without filters.
    await expect(page.getByRole("link", { name: "Clear search and filters" })).toHaveAttribute(
      "href",
      "/use-cases",
    );
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
