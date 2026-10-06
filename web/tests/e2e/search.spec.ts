import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

/** The names of the results shown, in order, by the link each row leads with. */
function shownResults(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 3 }).getByRole("link");
}

test.describe("search", () => {
  test.use({ locale: "en-US" });

  test("the All tab shows the best few of each kind, the kinds in the order of their best", async ({
    page,
  }) => {
    await page.goto("/search?q=AI");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("8 results for “AI”");
    await expect(page.getByRole("searchbox", { name: "Search BeyondPilot" })).toHaveValue("AI");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      "AI solutions 4",
      "Programs 2",
      "AI talent 1",
      "Use cases 1",
    ]);
    await expect(shownResults(page)).toHaveText([
      "AI Voice Agent",
      "Claims Desk",
      "Hotline Assist",
      "AI Youth Challenge",
      "NextGen AI Open Innovation Japan 2025",
      "Hieu Nguyen",
      "AI claims triage for motor insurance",
    ]);

    const tabs = page.getByRole("navigation", { name: "Kinds of result" });
    await expect(tabs.getByRole("link", { name: "All 8" })).toHaveAttribute("aria-current", "page");
    // A kind that has more than it shows leads to its own tab.
    await expect(page.getByRole("link", { name: "See all 4" })).toHaveAttribute(
      "href",
      "/search?q=AI&kind=solution",
    );

    const row = (name: string) =>
      page.getByRole("article").filter({ has: page.getByRole("link", { name, exact: true }) });
    // The matched word is in bold, read as text and never as markup.
    await expect(row("Hieu Nguyen").locator("strong")).toHaveText("AI");
    await expect(row("Hieu Nguyen").getByText("AI engineer · Vietnam")).toBeVisible();
    await expect(row("AI Voice Agent").getByText("By Revve AI")).toBeVisible();
    await expect(row("AI Voice Agent").getByText("1 customer case")).toBeVisible();
    await expect(
      row("Claims Desk").getByText("No customer case yet", { exact: false }),
    ).toBeVisible();
    await expect(row("AI Youth Challenge").getByText("Done")).toBeVisible();
    await expect(row("AI Youth Challenge").getByText("27 Apr 2026")).toBeVisible();
    await expect(page.getByRole("link", { name: "AI Youth Challenge" })).toHaveAttribute(
      "href",
      "/programs/ai-youth-challenge",
    );
    // A program whose page is elsewhere leads there.
    await expect(
      page.getByRole("link", { name: "NextGen AI Open Innovation Japan 2025" }),
    ).toHaveAttribute("href", "https://genaifund.ai/japan");
    // A use case of an organization that stays anonymous says so, with its budget and closing date.
    const useCase = row("AI claims triage for motor insurance");
    await expect(useCase.getByText("Organization not named")).toBeVisible();
    await expect(
      useCase.getByText("Insurance · USD 10,000–50,000 · Apply by 30 Nov 2026"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "AI claims triage for motor insurance" }),
    ).toHaveAttribute("href", "/use-cases?q=AI%20claims%20triage%20for%20motor%20insurance");
    await expectNoSeriousA11yViolations(page);
  });

  test("a kind's tab lists that kind and leads on to its directory", async ({ page }) => {
    await page.goto("/search?q=AI");
    await page.getByRole("link", { name: "See all 4" }).click();

    await expect(page).toHaveURL("/search?q=AI&kind=solution");
    // The title follows the navigation; the accessibility check reads it.
    await expect(page).toHaveTitle(/AI/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 AI solutions for “AI”");
    await expect(shownResults(page)).toHaveText([
      "AI Voice Agent",
      "Claims Desk",
      "Hotline Assist",
      "Policy Chat",
    ]);
    await expect(
      page
        .getByRole("navigation", { name: "Kinds of result" })
        .getByRole("link", { name: "AI solutions 4" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", {
        name: "Narrow by industry, capability and stage in the AI solutions directory",
      }),
    ).toHaveAttribute("href", "/solutions?q=AI");
    await expectNoSeriousA11yViolations(page);
  });

  test("a query that finds nothing offers queries to try and the directories", async ({ page }) => {
    await page.goto("/search?q=nothing");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing matches “nothing”");
    await expect(page.getByRole("navigation", { name: "Kinds of result" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Agentic AI" })).toHaveAttribute(
      "href",
      "/search?q=Agentic+AI",
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: "AI solutions" }),
    ).toHaveAttribute("href", "/solutions");
    await expectNoSeriousA11yViolations(page);
  });

  test("without a query the page asks for one, and a new query starts on the All tab", async ({
    page,
  }) => {
    await page.goto("/search");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search BeyondPilot");
    await page.getByRole("searchbox", { name: "Search BeyondPilot" }).fill("AI");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL("/search?q=AI");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("8 results for “AI”");
    await page.getByRole("link", { name: "Clear the search" }).click();
    await expect(page).toHaveURL("/search");
  });
});

test.describe("search on a phone", () => {
  test.use({ locale: "en-US", viewport: { width: 390, height: 844 } });

  test("the results fit the screen and the tabs scroll", async ({ page }) => {
    await page.goto("/search?q=AI");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("8 results for “AI”");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expectNoSeriousA11yViolations(page);
  });
});
