import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { serveStoredImages } from "./stored-files";

/** The solutions shown, by the name each card leads with. */
function shownSolutions(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link");
}

test.describe("solutions directory", () => {
  test.use({ locale: "en-US" });
  test.beforeEach(({ page }) => serveStoredImages(page));

  test("a visitor reads the approved solutions, each with who offers it and its proof", async ({
    page,
  }) => {
    await page.goto("/solutions");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI solutions");
    await expect(shownSolutions(page)).toHaveText([
      "Policy Chat",
      "Clinic Triage",
      "Claims Vision",
      "Underwriting Radar",
      "Agent Coach",
      "Broker Desk",
    ]);
    await expect(page.getByText("Showing 6 of 6")).toBeVisible();

    const card = (name: string) =>
      page.getByRole("article").filter({ has: page.getByRole("link", { name, exact: true }) });
    await expect(
      card("Policy Chat").getByRole("link", { name: "By Pocket Policy" }),
    ).toHaveAttribute("href", "/organizations/pocket-policy");
    await expect(card("Policy Chat").getByText("1 customer deployment")).toBeVisible();
    await expect(card("Clinic Triage").getByText("No customer case published")).toBeVisible();
    // A card names three capabilities and counts the rest.
    await expect(card("Claims Vision").getByText("+1 more")).toBeVisible();
    await expect(page.getByRole("link", { name: "List your solution" })).toHaveAttribute(
      "href",
      "/workspace/organization/solutions",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("search, a facet and the order are the address, and the server answers them", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/solutions");

    await page.getByRole("searchbox", { name: "Search by name or summary" }).fill("clinic");
    await expect(page).toHaveURL(/[?&]q=clinic/);
    await expect(shownSolutions(page)).toHaveText(["Clinic Triage"]);
    await expect(page.getByText("Showing 1 of 1")).toBeVisible();

    await page.goto("/solutions");
    if (isMobile) {
      // On a phone the facets fold behind one button.
      await page.getByRole("button", { name: "Filters" }).click();
    }
    await page.getByRole("combobox", { name: "Industry" }).click();
    await page.getByRole("option", { name: "Insurance" }).click();
    await expect(page).toHaveURL(/industry=insurance/);
    await expect(shownSolutions(page)).toHaveCount(5);

    await page.getByRole("combobox", { name: "Sort by" }).click();
    await page.getByRole("option", { name: "Name A–Z" }).click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(shownSolutions(page)).toHaveText([
      "Agent Coach",
      "Broker Desk",
      "Claims Vision",
      "Policy Chat",
      "Underwriting Radar",
    ]);

    // A link to this address shows the same list.
    await page.reload();
    await expect(shownSolutions(page)).toHaveCount(5);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/industry=/);
    await expect(shownSolutions(page)).toHaveCount(6);
  });

  test("a search that finds nothing says so and offers the way back", async ({ page }) => {
    await page.goto("/solutions?q=nothing&maturity=scaled");

    await expect(page.getByText("No solution matches")).toBeVisible();
    await page.getByRole("link", { name: "Clear search and filters" }).click();

    await expect(page).toHaveURL("/solutions");
    await expect(shownSolutions(page)).toHaveCount(6);
  });

  test("a solution page keeps its criteria visible and omits fields it has not supplied", async ({
    page,
  }) => {
    await page.goto("/solutions");
    await page.getByRole("link", { name: "Policy Chat", exact: true }).click();

    await expect(page).toHaveURL("/solutions/policy-chat");
    await expect(page).toHaveTitle(/Policy Chat/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Policy Chat");
    await expect(page.getByText("Policy holders wait days for an answer.")).toBeVisible();
    const fact = (name: string) => page.locator('[data-slot="fact"]').filter({ hasText: name });
    await expect(fact("Industries")).toContainText("Insurance");
    await expect(fact("Deployment")).toContainText("Cloud (SaaS)");
    await expect(page.getByText("In production").first()).toBeVisible();
    await expect(fact("Registered in")).toContainText("Singapore");
    await expect(fact("Funding (GenAI Fund)")).toContainText("Not listed yet");
    await expect(page.getByText("Key milestones")).toBeVisible();
    await expect(page.getByText("Three production pilots across banking.")).toBeVisible();
    // Product and company-stated fields are separate from the reviewed customer deployments.
    await expect(fact("Languages")).toContainText("Vietnamese, English");
    await expect(
      page.getByText("Insurers with a call centre of fifty seats or more."),
    ).toBeVisible();
    const payingCustomers = page
      .locator('[data-slot="evidence"]')
      .filter({ hasText: "Notable paying customers" });
    await expect(payingCustomers).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product" })).toBeVisible();
    await expect(page.getByText("Policy Voice", { exact: true })).toBeVisible();
    await expect(
      page.getByText("A voice agent with retrieval over policy documents."),
    ).toBeVisible();
    await expect(page.getByText("Python, PostgreSQL")).toBeVisible();
    await expect(page.getByText("AWS and Google Cloud")).toBeVisible();
    await expect(page.getByText("B2B2C", { exact: true })).toBeVisible();
    await expect(payingCustomers).toContainText("Mekong Life, Lotus Bank");
    await expect(payingCustomers.getByText("Stated by Pocket Policy")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Use cases" })).toBeVisible();
    await expect(page.getByText("Use-case examples")).toBeVisible();
    await expect(page.getByText("Claims intake: voice and chat for policyholders.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business model" })).toBeVisible();
    await expect(page.getByText("Bootstrapped")).toBeVisible();
    await expect(page.getByText("USD 500,000")).toBeVisible();
    await expect(page.getByText("Funding status")).toBeVisible();
    await expect(page.getByText("Funding raised")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alternatives" })).toBeVisible();
    await expect(page.getByText("ClaimLens, Manual claim queues")).toBeVisible();
    await expect(page.getByText("Founded 2018 · Team size: 20–99 employees")).toBeVisible();
    // Its cover and the two images under it; any of them opens large, with the others a step away.
    await expect(page.getByRole("img", { name: "The cover image of Policy Chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open image \d of 3$/ })).toHaveCount(3);
    await page.getByRole("button", { name: "Open image 2 of 3" }).click();
    const gallery = page.getByRole("dialog", { name: "Images of Policy Chat" });
    await expect(gallery.getByText("Image 2 of 3")).toBeVisible();
    await gallery.getByRole("button", { name: "Next image" }).click();
    await expect(gallery.getByText("Image 3 of 3")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Visit website" })).toHaveAttribute(
      "href",
      "https://pocketpolicy.example",
    );
    await expect(page.getByRole("link", { name: "Watch the demo" })).toHaveAttribute(
      "href",
      "https://pocketpolicy.example/demo",
    );
    // The deck is a file the backend serves at the solution's address.
    await expect(page.getByRole("link", { name: "Download the deck" })).toHaveAttribute(
      "href",
      "/api/solution/solutions/policy-chat/deck",
    );
    await expect(page.getByText("policy-chat-deck.pdf · 3.1 MB")).toBeVisible();
    // A listed solution does not say it is hidden.
    await expect(page.getByText("This solution is not in the directory")).toHaveCount(0);
    // Nobody is signed in, so nothing offers to edit it.
    await expect(page.getByRole("link", { name: "Edit this solution" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // Unset values leave criterion labels visible but remove their child fields.
    await page.goto("/solutions/clinic-triage");
    for (const label of ["Stage", "Industries", "Deployment"]) {
      const tag = page.locator('[data-slot="solution-tag"]').filter({ hasText: label });
      await expect(tag.locator(":scope > svg")).toBeVisible();
      await expect(tag.locator("span")).toHaveCount(1);
    }
    for (const title of [
      "Why it is worth it",
      "Problem it solves",
      "Product",
      "Who it is for",
      "Use cases",
      "Proof",
      "Customer references & case studies",
      "Business model",
      "Alternatives",
      "The company behind this solution",
    ]) {
      const heading = page.getByRole("heading", { name: title, exact: true });
      await expect(heading).toBeVisible();
      await expect(heading.locator(":scope > svg")).toBeVisible();
    }
    for (const name of [
      "Backed by",
      "Languages",
      "Industries",
      "Funding (GenAI Fund)",
    ]) {
      const criterion = fact(name);
      await expect(criterion).toBeVisible();
      await expect(criterion.locator("dt > svg")).toBeVisible();
      await expect(criterion).toContainText("Not listed yet");
    }
    for (const field of [
      "Product names",
      "Core technology",
      "Built with",
      "Hosting",
      "Best customer profile",
      "Segment focus",
      "Notable paying customers",
      "Use-case examples",
      "Funding status",
      "Funding raised",
      "Customer case",
      "No customer case published.",
      "An answer in seconds, in Vietnamese and English.",
      "Policy holders wait days for an answer.",
    ]) {
      await expect(page.getByText(field, { exact: true })).toHaveCount(0);
    }
    await expect(page.locator('[data-slot="solution-gallery"]')).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    expect((await page.goto("/solutions/no-such-solution"))?.status()).toBe(404);
  });

  test("an approved solution left unlisted opens by its address, says so and stays out of the directory and of search engines", async ({
    page,
  }) => {
    await page.goto("/solutions");
    await expect(page.getByRole("link", { name: "Private Pilot", exact: true })).toHaveCount(0);

    await page.goto("/solutions/private-pilot");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Private Pilot");
    await expect(page.getByText("This solution is not in the directory")).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Watch the demo" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a customer deployment opens with its problem, what was deployed and its source", async ({
    page,
  }) => {
    await page.goto("/solutions/policy-chat");

    await page.getByRole("button", { name: "Renewals at Mekong Life" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Renewals at Mekong Life" })).toBeVisible();
    await expect(
      dialog.getByText(
        "Policy Chat, deployed by Pocket Policy. In production; reviewed by GenAI Fund on Oct 1, 2026.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText("Renewal questions filled the call centre every quarter."),
    ).toBeVisible();
    await expect(dialog.getByText("Half of renewals answered without an agent.")).toBeVisible();
    // What the company left out reads as not published.
    await expect(dialog.getByText("Not published")).toHaveCount(2);
    await expect(dialog.getByRole("link", { name: "Pocket Policy" })).toHaveAttribute(
      "href",
      "/organizations/pocket-policy",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("an organization's page lists its solutions, a few at first, and its deployments", async ({
    page,
  }) => {
    await page.goto("/solutions/policy-chat");
    await page.getByRole("link", { name: "By Pocket Policy" }).click();

    await expect(page).toHaveURL("/organizations/pocket-policy");
    await expect(page).toHaveTitle("Pocket Policy · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pocket Policy");
    await expect(
      page.locator('header img[src$="/0b6f2f0e-5d0e-4c57-9a55-6f6f3c1d2a10"]'),
    ).toBeVisible();
    await expect(page.getByText("Company · Singapore")).toBeVisible();
    await expect(page.getByText("Insurance, Banking and finance")).toBeVisible();
    await expect(page.getByRole("link", { name: "pocketpolicy.example" })).toHaveAttribute(
      "href",
      "https://www.pocketpolicy.example/",
    );

    const solutions = page.getByRole("main").getByRole("heading", { level: 3 }).getByRole("link");
    await expect(solutions).toHaveText([
      "Policy Chat",
      "Claims Vision",
      "Underwriting Radar",
      "Agent Coach",
    ]);
    // Each card names the first industry of its solution and points to its page.
    await expect(page.getByText("Insurance", { exact: true })).toHaveCount(4);
    await expect(page.getByText("Explore solution")).toHaveCount(4);
    await expect(page.getByText("1 customer deployment, listed below")).toBeVisible();
    await expect(page.getByRole("button", { name: "Renewals at Mekong Life" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("link", { name: "Load more" }).click();
    await expect(page).toHaveURL("/organizations/pocket-policy?more=1");
    await expect(solutions).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Load more" })).toHaveCount(0);
  });

  test("an organization without deployments says so, and an unknown one is not found", async ({
    page,
  }) => {
    const answer = await page.goto("/organizations/lumen-health?more=3");
    expect(answer?.status()).toBe(200);
    await expect(page.getByText("Builder team · Vietnam")).toBeVisible();
    await expect(page.getByText("No customer deployment published.")).toBeVisible();

    expect((await page.goto("/organizations/no-such-organization"))?.status()).toBe(404);
  });
});
