import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const applyUrl = "/programs/insurance-ai-tasco/apply";

test.describe("programs", () => {
  test.use({ locale: "en-US", timezoneId: "Europe/Paris" });

  test("the list shows what is open now, what is coming up and what is done", async ({ page }) => {
    await page.goto("/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programs and events");
    const open = page.getByRole("region", { name: "Open now" });
    await expect(
      open.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(open.getByText(/days left · closes/)).toBeVisible();
    await expect(open.getByRole("link", { name: "Apply now" })).toHaveAttribute("href", applyUrl);

    // An event the open card already shows is not repeated under Coming up.
    await expect(
      open.getByText("Stop Guessing What Insurers Need: Tasco Challenge Briefing"),
    ).toBeVisible();
    const coming = page.getByRole("region", { name: "Coming up" });
    await expect(
      coming.getByText("Stop Guessing What Insurers Need", { exact: false }),
    ).toHaveCount(0);
    await expect(coming.getByRole("link", { name: "GenAI Builders Hanoi" })).toBeVisible();

    // A program whose page is somewhere else links there, and is never a draft on the list.
    const done = page.getByRole("region", { name: "Done" });
    await expect(done.getByRole("link", { name: "Agentic AI Build Week 2026" })).toHaveAttribute(
      "href",
      "https://genaifund.ai/blog/",
    );
    await expect(page.getByText("GenAI Monthly Meetup")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("the tabs and the type are the address", async ({ page }) => {
    await page.goto("/programs");

    // Under Coming up alone, the open program's next event is listed again.
    await page.getByRole("tab", { name: "Coming up" }).click();
    await expect(
      page.getByText("Stop Guessing What Insurers Need: Tasco Challenge Briefing"),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Done" }).click();
    await expect(page).toHaveURL(/[?&]phase=done/);
    await expect(page.getByRole("region", { name: "Open now" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Agentic AI Build Week 2026" })).toBeVisible();

    await page.goto("/programs?type=event_series");
    await expect(page.getByRole("link", { name: "GenAI Builders Hanoi" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Search programs and events" }).fill("Tasco");
    await expect(page).toHaveURL(/(?=.*q=Tasco)(?=.*type=event_series)/);
    await expect(page.getByText("No programs here yet")).toBeVisible();
    await page.getByRole("combobox", { name: "Type of program" }).click();
    await page.getByRole("option", { name: "All types", exact: true }).click();
    await expect(page).toHaveURL(/q=Tasco/);
    await expect(
      page.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "GenAI Builders Hanoi" })).toHaveCount(0);
    await expect(page.getByText("1 program", { exact: true })).toBeVisible();
  });

  test("a standard page shows the program, its timeline and when it starts", async ({ page }) => {
    await page.goto("/programs/genai-builders-hanoi");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GenAI Builders Hanoi");
    await expect(page.getByText("Bring a demo.")).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Doors open" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Apply now" })).toHaveCount(0);
    // A program with no use case attached has no such section.
    await expect(page.locator("#use-cases")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("the Tasco page is the one made for it, with the program's dates", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/programs/insurance-ai-tasco");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AI for Insurance Challenge × Tasco",
    );
    await expect(
      page.getByText("How might we make insurance in Vietnam", { exact: false }),
    ).toBeVisible();
    // The timeline is the program's: its key date and its window, named in the visitor's language.
    const timeline = page.locator("#timeline");
    await expect(timeline.getByText("Demo day: ten teams present live")).toBeVisible();
    await expect(timeline.getByText("Applications close")).toBeVisible();
    await expect(
      page.locator("#judges").getByRole("link", { name: "Laura Nguyen on LinkedIn" }),
    ).toBeVisible();
    // The use cases attached to the program, and only those, each leading to its brief.
    const useCases = page.locator("#use-cases");
    await expect(useCases.getByRole("heading", { level: 2 })).toHaveText(
      "Use cases in this challenge",
    );
    await expect(useCases.getByRole("heading", { level: 3 })).toHaveText([
      "Voice assistant for vehicle owners",
      "Claims triage with document intelligence",
    ]);
    await expect(
      page.getByRole("navigation", { name: "On this page" }).getByRole("link", {
        name: "Use cases",
      }),
    ).toHaveAttribute("href", "#use-cases");
    await expect(page.getByRole("link", { name: "Apply now" }).first()).toHaveAttribute(
      "href",
      applyUrl,
    );
    // What the campaign's earlier page said: the client, the month after demo day, the support, the
    // myths and its questions, each reached from the page's navigation.
    const nav = page.getByRole("navigation", { name: "On this page" });
    for (const [name, id] of [
      ["Tasco", "client"],
      ["Pilot month", "pilot"],
      ["Support", "support"],
      ["Myths", "myths"],
    ]) {
      await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", `#${id}`);
      await expect(page.locator(`#${id}`).getByRole("heading", { level: 2 })).toBeVisible();
    }
    const client = page.locator("#client");
    await expect(client.getByRole("listitem").filter({ hasText: "HNX: HUT" })).toBeVisible();
    await expect(
      client.getByRole("heading", { name: "Why Tasco is doing this at all" }),
    ).toBeVisible();
    await expect(
      page.locator("#directions").getByRole("heading", { name: "Why efficiency matters here" }),
    ).toBeVisible();
    await expect(timeline.getByRole("heading", { level: 3 })).toHaveText([
      "Start on day one",
      "How selection works",
    ]);
    const pilot = page.locator("#pilot");
    await expect(pilot.getByRole("heading", { level: 3 })).toHaveText([
      "Selection and scoping conversation",
      "Scope lock",
      "Build",
      "Integrate and checkpoint",
      "Test and evaluate",
      "Tasco decides",
      "Good to know",
    ]);
    await expect(pilot.getByRole("term").filter({ hasText: "Done when" })).toHaveCount(5);
    await expect(
      page.locator("#submit").getByRole("heading", { name: "Design requirements" }),
    ).toBeVisible();
    await expect(page.locator("#support").getByRole("listitem")).toHaveCount(4);
    const myths = page.locator("#myths");
    await expect(myths.getByRole("listitem")).toHaveCount(5);
    await expect(myths.getByText("There is no RFP here.", { exact: false })).toBeVisible();
    const faq = page.locator("#faq");
    await expect(faq.getByRole("button")).toHaveCount(13);
    await faq.getByRole("button", { name: "Is there prize money?" }).click();
    await expect(faq.getByText("What's on offer is a customer.", { exact: false })).toBeVisible();
    // The navigation wraps: the page is never wider than the screen.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (isMobile) {
      // On a phone the card to apply comes before the challenge.
      const card = await page
        .getByText("Applications close", { exact: true })
        .first()
        .boundingBox();
      const challenge = await page.getByRole("heading", { name: "The challenge" }).boundingBox();
      expect(card!.y).toBeLessThan(challenge!.y);
    }
    await expectNoSeriousA11yViolations(page);

    await page.goto("/vi/programs/insurance-ai-tasco");
    await expect(page.getByRole("heading", { name: "Thử thách", exact: true })).toBeVisible();
  });

  test("a draft is found by an operator only, under a banner that leads back", async ({
    page,
    context,
    baseURL,
  }) => {
    expect((await page.goto("/programs/genai-monthly-meetup"))?.status()).toBe(404);

    await signInAs(context, "operator", baseURL!);
    await page.goto("/programs/genai-monthly-meetup");
    await expect(page.getByRole("status")).toContainText("Only operators can see this page");
    await expect(page.getByRole("link", { name: "Back to settings" })).toHaveAttribute(
      "href",
      "/admin/programs/9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c01/settings",
    );
  });

  test("an unknown address is not found", async ({ page }) => {
    expect((await page.goto("/programs/no-such-program"))?.status()).toBe(404);
  });
});
