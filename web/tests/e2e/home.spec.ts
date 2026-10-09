import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("home page", () => {
  test.use({ locale: "en-US" });

  test("shows the live challenge, the sections and the footer", async ({ page }) => {
    // The challenge bar goes once submissions close, so the test stands before the deadline.
    await page.clock.setFixedTime(new Date("2026-10-10T09:00:00+07:00"));
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /AI for Insurance Challenge × Tasco.*Apply/ }),
    ).toHaveAttribute("href", "https://beyondpilot.genaifund.ai/insurance-ai-tasco");
    await expect(
      page.getByRole("heading", { level: 1, name: /Your next step in\s+AI starts here/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Five ways to explore BeyondPilot" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "The team building BeyondPilot" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Founders building across the ecosystem" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "The network behind every program" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("the challenge bar goes once submissions have closed", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-16T09:00:00+07:00"));
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your next step in\s+AI starts here/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /AI for Insurance Challenge × Tasco.*Apply/ }),
    ).toHaveCount(0);
  });

  test("an example prompt runs the search", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Find an AI solution for insurance claims" }).click();
    await expect(page).toHaveURL(/\/search\?q=Find/);
  });

  test("the five categories lead to their directories", async ({ page }) => {
    await page.goto("/");

    const categories = page
      .getByRole("region")
      .or(page.locator("section"))
      .filter({
        has: page.getByRole("heading", { name: "Five ways to explore BeyondPilot" }),
      });
    await expect(categories.getByRole("heading", { level: 3 })).toHaveText([
      "AI Solutions",
      "AI Talent",
      "Use Cases & Projects",
      "AI Events",
      "AI Programs",
    ]);
    await categories.getByRole("link", { name: /Explore solutions/ }).click();
    await expect(page).toHaveURL("/solutions");
  });

  test("the search leads to its results", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("searchbox", {
        name: "Search AI solutions, talent, use cases, events, and programs",
      })
      .fill("AI");
    await page.keyboard.press("Enter");

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
    await expect(page.getByRole("dialog").getByRole("link", { name: /AI Talent/ })).toBeVisible();
  });
});
