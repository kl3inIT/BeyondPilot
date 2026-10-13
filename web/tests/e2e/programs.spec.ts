import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const applyUrl = "/programs/insurance-ai-tasco/apply";

test.describe("programs", () => {
  test.use({ locale: "en-US", timezoneId: "Europe/Paris" });

  test("the list shows what is open now, what is coming up and what is done", async ({ page }) => {
    await page.goto("/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programs and events");
    // Two programs take applications; each card carries its own countdown and Apply.
    const open = page.getByRole("region", { name: "Open now" });
    await expect(open.getByRole("link", { name: "Nestlé Vietnam AI Reinvention" })).toBeVisible();
    const tasco = open.getByRole("article").filter({ hasText: "Tasco" });
    await expect(
      tasco.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(tasco.getByText(/days left · closes/)).toBeVisible();
    await expect(tasco.getByRole("link", { name: "Apply now" })).toHaveAttribute("href", applyUrl);

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

  test("the Nestlé page is the one made for it, with the program's dates", async ({ page }) => {
    await page.goto("/programs/nestle-vietnam-ai-reinvention");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nestlé Vietnam AI Reinvention",
    );
    await expect(
      page.getByText("Nestlé has picked their problems.", { exact: false }),
    ).toBeVisible();
    // The deadline in the closing call and among the four facts is the program's window, not page copy.
    await expect(
      page.getByText(/Applications close \d+ \w+, \d\d:\d\d ICT\./).first(),
    ).toBeVisible();
    const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(hero.getByRole("term")).toHaveText([
      "▦Applications close",
      "⌖Matching Day",
      "⚲The opportunity",
      "⚇Who can apply",
    ]);
    await expect(hero.getByRole("definition").first()).toHaveText(/^\d+ \w+, \d\d:\d\d ICT$/);
    const applyUrl = "/programs/nestle-vietnam-ai-reinvention/apply";
    await expect(page.getByRole("link", { name: "Apply now" }).first()).toHaveAttribute(
      "href",
      applyUrl,
    );

    // The page's own way round stays on the screen: a button that opens the list of sections.
    const menu = page.getByRole("button", { name: "On this page" });
    for (const [name, id] of [
      ["Benefits", "offers"],
      ["Challenges", "areas"],
      ["Use cases", "use-cases"],
      ["How it works", "how"],
      ["Eligibility", "eligibility"],
      ["Dates", "dates"],
      ["FAQ", "faq"],
    ]) {
      await menu.click();
      const link = page
        .getByRole("navigation", { name: "On this page" })
        .getByRole("link", { name, exact: true });
      await expect(link).toHaveAttribute("href", `#${id}`);
      await link.click();
      await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
      await expect(page.locator(`#${id}`).getByRole("heading", { level: 2 })).toBeVisible();
    }
    await menu.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
    await expect(menu).toBeFocused();
    await expect(page.locator("#offers").getByRole("listitem")).toHaveCount(3);

    // Six tabs over one panel: the first area is open, another replaces it, the last is the invitation.
    const areas = page.locator("#areas");
    await expect(areas.getByRole("tab")).toHaveCount(6);
    const panel = areas.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { level: 3 })).toHaveText(
      "Document processing & trade compliance",
    );
    for (const label of ["What it looks like today", "What good looks like", "Bring us"]) {
      await expect(panel.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(panel.getByRole("listitem")).toHaveCount(5);
    await areas.getByRole("tab", { name: "Smart manufacturing & AI automation" }).click();
    await expect(panel.getByRole("heading", { level: 3 })).toHaveText(
      "Smart manufacturing & AI automation",
    );
    await expect(panel.getByText("Predictive maintenance")).toBeVisible();
    await expect(panel.getByText("HS-code decision support")).toHaveCount(0);
    // The arrow keys move between the tabs.
    await page.keyboard.press("ArrowDown");
    await expect(
      areas.getByRole("tab", { name: "Legal, regulatory & employee support" }),
    ).toBeFocused();
    await areas.getByRole("tab", { name: "Something more" }).click();
    await expect(
      panel.getByText("Have experience applying AI in FMCG", { exact: false }),
    ).toBeVisible();
    await expect(areas.getByText("Recognise one of these?")).toBeVisible();

    // The use cases attached to the program, and only those.
    await expect(page.locator("#use-cases").getByRole("heading", { level: 3 })).toHaveText([
      "Claims triage with document intelligence",
      "Demand forecasting for a retail chain",
    ]);
    await expect(page.locator("#how").getByRole("listitem")).toHaveCount(4);
    const eligibility = page.locator("#eligibility");
    await expect(eligibility.getByRole("heading", { level: 3 })).toHaveText([
      "What you need",
      "The six questions you'll answer in the room",
    ]);
    await expect(eligibility.getByText("Screening also checks")).toBeVisible();
    await expect(
      eligibility.getByText("What capability does Nestlé keep afterwards?"),
    ).toBeVisible();

    // The row of dates is the program's: its key date, its window and its event; the activities are the page's.
    const dates = page.locator("#dates");
    await expect(dates.getByRole("heading", { name: "Matching Day", exact: true })).toBeVisible();
    await expect(
      dates.getByRole("heading", { name: "Applications close", exact: true }),
    ).toBeVisible();
    await expect(dates.getByText("Every applicant hears back")).toBeVisible();
    await expect(dates.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "https://luma.com/nestle-info-session",
    );
    await expect(dates.getByRole("heading", { level: 4 })).toHaveText([
      "During applications",
      "Before Matching Day",
      "After Matching Day",
    ]);
    // Every question opens on its answer, none before it is asked.
    const faq = page.locator("#faq");
    await expect(faq.locator("summary")).toHaveCount(8);
    await expect(faq.getByText("There is no cash prize.", { exact: false })).toBeHidden();
    await faq.getByText("Is there prize money?").click();
    await expect(faq.getByText("There is no cash prize.", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Will your solution be in the room on 15 December\?/ }),
    ).toBeVisible();
    // The way to apply stays at the foot of the screen, and goes where every other Apply goes.
    await expect(
      page
        .getByRole("complementary", { name: "Applications" })
        .getByRole("link", { name: "Apply now" }),
    ).toHaveAttribute("href", applyUrl);
    // The page is never wider than the screen.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expectNoSeriousA11yViolations(page);

    await page.goto("/vi/programs/nestle-vietnam-ai-reinvention");
    await expect(
      page.getByRole("heading", { name: "Chương trình mang lại gì", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(6);
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
