import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const draft = "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c01";
const tasco = "9b1e7c2a-4d3f-4a8b-9c6d-1e2f3a4b5c02";

/** The one of a pair of controls the viewport shows: the header's on a desktop, the foot's on a phone. */
function shown(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).and(page.locator(":visible"));
}

/**
 * Opens a program's Settings and waits until its scripts have loaded, so that what a test types is
 * held by the form and not by the page as the server sent it.
 */
async function openSettings(page: Page, id: string) {
  await page.goto(`/admin/programs/${id}/settings`);
  await page.waitForLoadState("networkidle");
}

/** Answers a command the browser sends about a program; returns the bodies it saw. */
async function answer(page: Page, path: string, status: number, body?: object) {
  const sent: unknown[] = [];
  await page.route(`**${path}`, async (route) => {
    const request = route.request();
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    sent.push(request.postDataJSON());
    const problem = status >= 400;
    await route.fulfill({
      status,
      contentType: problem ? "application/problem+json" : "application/json",
      body: body ? JSON.stringify(body) : undefined,
    });
  });
  return sent;
}

test.describe("admin programs", () => {
  test.use({ locale: "en-US", timezoneId: "Europe/Paris" });

  test("nobody but an operator gets the programs", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/programs", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Fprograms");

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/programs"))?.status()).toBe(404);
    expect((await page.goto(`/admin/programs/${tasco}/settings`))?.status()).toBe(404);
  });

  test("the list shows each program's state and window", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programs");
    await expect(page.getByRole("link", { name: "GenAI Monthly Meetup" })).toBeVisible();
    await expect(
      page.getByText("Draft", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible();
    // Times are written in Vietnam whatever the zone of the browser.
    await expect(
      page.getByText("Sep 23 – Oct 15, 2026, 23:59 ICT").and(page.locator(":visible")),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);

    // The tabs count each state; a tab and a search narrow the list, and the address keeps them.
    await expect(page.getByRole("tab", { name: "Drafts 1" })).toBeVisible();
    await page.getByRole("tab", { name: "Drafts 1" }).click();
    await expect(page).toHaveURL(/[?&]state=draft/);
    await expect(
      page.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "All 2" }).click();
    await page.getByRole("searchbox", { name: "Search programs by name" }).fill("tasco");
    await expect(page).toHaveURL(/[?&]q=tasco/);
    await expect(page.getByRole("link", { name: "GenAI Monthly Meetup" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search programs by name" }).fill("nothing like it");
    await expect(page.getByText("No programs match").and(page.locator(":visible"))).toBeVisible();
    await page
      .getByRole("link", { name: "Show all programs" })
      .and(page.locator(":visible"))
      .click();
    await expect(page).toHaveURL("/admin/programs");

    await page.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }).click();
    await expect(page).toHaveURL(`/admin/programs/${tasco}/settings`);
  });

  test("New program suggests the address from the name and opens the draft", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const created = await answer(page, "/api/program/admin/programs", 201, { id: draft });
    await page.goto("/admin/programs");

    await page.getByRole("button", { name: "New program" }).click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Name" })
      .fill("GenAI Monthly Meetup · Hà Nội");
    await expect(page.getByRole("dialog").getByRole("textbox", { name: "Address" })).toHaveValue(
      "genai-monthly-meetup-ha-noi",
    );
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: "Create program" }).click();

    await expect(page).toHaveURL(`/admin/programs/${draft}/settings`);
    expect(created).toEqual([
      {
        name: "GenAI Monthly Meetup · Hà Nội",
        slug: "genai-monthly-meetup-ha-noi",
        type: "enterprise_challenge",
      },
    ]);
  });

  test("a taken address is refused beside the field", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    await answer(page, "/api/program/admin/programs", 409, {
      status: 409,
      code: "PROGRAM_SLUG_TAKEN",
    });
    await page.goto("/admin/programs");

    await page.getByRole("button", { name: "New program" }).click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Name" })
      .fill("AI for Insurance Challenge");
    await page.getByRole("button", { name: "Create program" }).click();

    await expect(page.getByText("Another program already has this address.")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Address" }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  test("a draft lists what blocks publishing, and each line leads to its field", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await openSettings(page, draft);

    await expect(page.getByRole("heading", { name: "Before you can publish" })).toBeVisible();
    await expect(shown(page, "Publish")).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("link", { name: "Add a summary" }).click();
    await expect(page.getByRole("textbox", { name: "Summary" })).toBeFocused();
    await page.keyboard.type("Builders meet once a month in Hanoi.");
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await expect(shown(page, "Save and publish")).toBeEnabled();
  });

  test("a save sends the whole program with its times in Vietnam", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const saved = await answer(page, `/api/program/admin/programs/${draft}`, 200, {
      id: draft,
      slug: "genai-monthly-meetup",
      slugFixed: false,
      publishIssues: ["cover"],
      name: "GenAI Monthly Meetup",
      type: "event_series",
      status: "draft",
      pageKind: "standard",
      keyDates: [],
      events: [],
      version: 1,
      createdAt: "2026-10-05T03:00:00Z",
      updatedAt: "2026-10-05T04:00:00Z",
    });
    await openSettings(page, draft);

    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("Builders meet once a month in Hanoi.");
    await page.getByLabel("Starts", { exact: true }).fill("2026-11-02");
    await page.getByLabel("Ends", { exact: true }).fill("2026-11-02");
    await page.getByRole("checkbox", { name: "Applications are taken on BeyondPilot" }).click();
    await page.getByLabel("Opens", { exact: true }).fill("2026-10-20");
    await page.getByLabel("Time", { exact: true }).nth(0).fill("09:00");
    await page.getByLabel("Closes", { exact: true }).fill("2026-11-01");
    await page.getByLabel("Time", { exact: true }).nth(1).fill("23:59");

    await page.getByRole("button", { name: "Add a date" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Title" }).fill("Demo night");
    await dialog.getByLabel("Date", { exact: true }).fill("2026-11-02");
    await dialog.getByLabel("From", { exact: true }).fill("18:30");
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Demo night")).toBeVisible();
    await expect(page.getByText("Submissions close")).toBeVisible();

    await shown(page, "Save changes").click();
    await expect(page.getByText("Saved.")).toBeVisible();
    expect(saved).toEqual([
      expect.objectContaining({
        version: 0,
        summary: "Builders meet once a month in Hanoi.",
        startsOn: "2026-11-02",
        endsOn: "2026-11-02",
        applications: {
          opensAt: "2026-10-20T02:00:00.000Z",
          closesAt: "2026-11-01T16:59:00.000Z",
          shortlistSize: null,
          outcomesDueOn: null,
          allowUpdatesUntilClose: true,
        },
        keyDates: [
          {
            title: "Demo night",
            startsAt: "2026-11-02T11:30:00.000Z",
            endsAt: null,
            allDay: false,
            note: null,
          },
        ],
      }),
    ]);
  });

  test("dates out of order are refused before anything is sent", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const saved = await answer(page, `/api/program/admin/programs/${draft}`, 200, {});
    await openSettings(page, draft);

    // Typed before the form has hydrated, a value is lost; typing again until the form holds it.
    await expect(async () => {
      await page.getByLabel("Starts", { exact: true }).fill("2026-11-09");
      await page.getByLabel("Ends", { exact: true }).fill("2026-11-02");
      await expect(page.getByText("You have unsaved changes.")).toBeVisible({ timeout: 1000 });
      await expect(page.getByLabel("Starts", { exact: true })).toHaveValue("2026-11-09", {
        timeout: 1000,
      });
    }).toPass();
    await shown(page, "Save changes").click();

    await expect(page.getByText("The end is before the start.")).toBeVisible();
    expect(saved).toEqual([]);
  });

  test("someone else's save in the meantime is said above the form", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answer(page, `/api/program/admin/programs/${tasco}`, 409, {
      status: 409,
      code: "PROGRAM_CHANGED_MEANWHILE",
    });
    await openSettings(page, tasco);

    await page.getByRole("textbox", { name: "Summary" }).fill("Changed here too.");
    await shown(page, "Save changes").click();

    await expect(
      page.getByText("Someone else saved this program in the meantime.", { exact: false }),
    ).toBeVisible();
  });

  test("a published program's address is fixed and nothing blocks it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await openSettings(page, tasco);
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Address" })).toBeDisabled();
    await expect(
      page.getByText("The address is fixed once the program has been published.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before you can publish" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a published program is unpublished after the operator confirms", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const unpublished = await answer(page, `/api/program/admin/programs/${tasco}/unpublish`, 204);
    await openSettings(page, tasco);

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Unpublish…" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("beyondpilot.genaifund.ai/programs/insurance-ai-tasco");
    await expectNoSeriousA11yViolations(page);
    await confirm.getByRole("button", { name: "Unpublish" }).click();

    await expect(
      page.getByText("AI for Insurance Challenge × Tasco is no longer public."),
    ).toBeVisible();
    expect(unpublished).toHaveLength(1);
  });

  test("a ready draft is published after the operator confirms", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const ready = {
      id: draft,
      slug: "genai-monthly-meetup",
      slugFixed: false,
      publishIssues: [],
      name: "GenAI Monthly Meetup",
      type: "event_series",
      summary: "Builders meet once a month in Hanoi.",
      startsOn: "2026-11-02",
      endsOn: "2026-11-02",
      coverFileId: "4c0d5f9e-2b1a-4e3c-8d7f-6a5b4c3d2e02",
      status: "draft",
      pageKind: "standard",
      keyDates: [],
      events: [],
      version: 1,
      createdAt: "2026-10-05T03:00:00Z",
      updatedAt: "2026-10-05T04:00:00Z",
    };
    const saved = await answer(page, `/api/program/admin/programs/${draft}`, 200, ready);
    const published = await answer(page, `/api/program/admin/programs/${draft}/publish`, 204);
    await openSettings(page, draft);

    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("Builders meet once a month in Hanoi.");
    await shown(page, "Save and publish").click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("From now on its address is fixed");
    await confirm.getByRole("button", { name: "Save and publish" }).click();

    await expect(page.getByText("GenAI Monthly Meetup is published.")).toBeVisible();
    expect(saved).toHaveLength(1);
    expect(published).toHaveLength(1);
  });
});
