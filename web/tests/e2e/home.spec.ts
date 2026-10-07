import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("home page", () => {
  test.use({ locale: "en-US" });

  test("shows the live campaign, the sections and the footer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /Live .*Apply/ })).toHaveAttribute(
      "href",
      "https://beyondpilot.genaifund.ai/insurance-ai-tasco",
    );
    await expect(page.getByRole("heading", { name: "Programs and events" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Explore the directory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions and answers" })).toBeVisible();
    await expect(page.getByText("Anyone with a solution")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("the directory shows the directories' own counts and cards", async ({ page }) => {
    await page.goto("/");

    // The newest use cases open the directory, with the public count beside their tab from md up.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(page.getByRole("tab", { name: /Use cases\s*3/ })).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { name: "Voice assistant for vehicle owners" }),
    ).toBeVisible();

    const solutions = page.getByRole("tab", { name: /AI solutions/ });
    await solutions.click();

    await expect(solutions).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Policy Chat" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Voice assistant for vehicle owners" }),
    ).toBeHidden();

    await page.getByRole("tab", { name: /Programs/ }).click();
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("heading", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
  });

  test("the search leads to its results", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("searchbox", { name: "Search the directory" }).fill("AI");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL("/search?q=AI");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("8 results for “AI”");
  });

  test("a planned page renders the coming-soon screen", async ({ page }) => {
    await page.goto("/get-started");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coming soon");
  });
});

test.describe("home page on a phone", () => {
  test.use({ locale: "en-US", viewport: { width: 390, height: 844 } });

  test("nothing runs past the screen edge", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("opens the menu from the menu button", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /AI talent/ })).toBeVisible();
  });
});
