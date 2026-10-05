import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const applyUrl = "https://beyondpilot.genaifund.ai/insurance-ai-tasco/apply";

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
  });

  test("a standard page shows the program, its timeline and when it starts", async ({ page }) => {
    await page.goto("/programs/genai-builders-hanoi");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GenAI Builders Hanoi");
    await expect(page.getByText("Bring a demo.")).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Doors open" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Apply now" })).toHaveCount(0);
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
    await expect(page.getByRole("link", { name: "Apply now" }).first()).toHaveAttribute(
      "href",
      applyUrl,
    );
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
    await expect(page.getByRole("heading", { name: "Thử thách" })).toBeVisible();
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
