import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { hydrated } from "./hydration";

test.describe("home page", () => {
  test.use({ locale: "en-US" });

  test("shows the live challenge, the sections and the footer", async ({ page }) => {
    // The challenge bar goes once submissions close, so the test stands before the deadline.
    await page.clock.setFixedTime(new Date("2026-10-10T09:00:00+07:00"));
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /AI for Insurance Challenge × Tasco.*Apply/ }),
    ).toHaveAttribute("href", "/programs/insurance-ai-tasco");
    await expect(
      page.getByRole("heading", { level: 1, name: /Your next step in\s+AI starts here/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Five ways to explore BeyondPilot" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "The team building BeyondPilot" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("heading", { name: /^Founders/ })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "The network behind every program" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("the featured program is announced once, then waits in the corner", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("button", { name: /Nestlé Vietnam AI Reinvention/ });
    await expect(card).toBeVisible();
    // A first visit: nothing kept in this browser yet.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const announcement = page.getByRole("dialog", { name: "Nestlé Vietnam AI Reinvention" });
    await expect(announcement).toBeVisible();
    // Its words and dates are the program's, as an operator entered them.
    await expect(
      announcement.getByText("Don't miss your chance to collaborate with Nestlé Vietnam."),
    ).toBeVisible();
    await expect(announcement.getByText("Deadline")).toBeVisible();
    await expect(announcement.getByText("Matching Day")).toBeVisible();
    await expect(
      announcement.getByRole("link", { name: "Explore the program & apply" }),
    ).toHaveAttribute("href", "/programs/nestle-vietnam-ai-reinvention");
    await expectNoSeriousA11yViolations(page);

    await announcement.getByRole("button", { name: "Maybe later" }).click();
    await expect(announcement).toBeHidden();
    await card.click();
    await expect(announcement).toBeVisible();
    await page.keyboard.press("Escape");

    // A later visit meets only the card.
    await page.reload();
    await expect(card).toBeVisible();
    await expect(announcement).toBeHidden();
  });

  test("the featured program goes once its applications have closed", async ({ page }) => {
    // The stub's program closes 33 days after it starts.
    await page.clock.setFixedTime(new Date(Date.now() + 40 * 24 * 60 * 60 * 1000));
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nestlé Vietnam AI Reinvention/ })).toHaveCount(
      0,
    );
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

  test("the events card lists the next two events of the programs, each leading to its registration", async ({
    page,
  }) => {
    await page.goto("/");

    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "AI Events" }) });
    const events = card.getByRole("listitem");
    await expect(events).toHaveCount(2);
    await expect(events.nth(0)).toContainText(
      "Stop Guessing What Insurers Need: Tasco Challenge Briefing",
    );
    await expect(events.nth(0)).toContainText("AI for Insurance Challenge × Tasco · Online");
    await expect(events.nth(1)).toContainText("Nestlé Vietnam AI Reinvention info session");
    await expect(
      card.getByRole("link", { name: /Stop Guessing What Insurers Need/ }),
    ).toHaveAttribute("href", "https://luma.com/tasco-briefing");
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

    await (await hydrated(page.getByRole("button", { name: "Open menu" }))).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /AI Talent/ })).toBeVisible();
  });
});
