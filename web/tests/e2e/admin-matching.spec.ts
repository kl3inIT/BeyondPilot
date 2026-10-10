import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

/** What the stub backend answers for the limits (tests/e2e/stub-matching.mjs). */
const stored = {
  settleMinutes: 10,
  editRunsPerDay: 3,
  memberRunsPerDay: 3,
  runsPerDay: 200,
  candidates: 40,
  parallel: 8,
  version: 3,
};

type Saved = Omit<typeof stored, "runsPerDay"> & { runsPerDay?: number };

/**
 * Answers the browser's own requests for the limits. A save is answered by `save`, which is given
 * the body and how many saves came before it; a read is answered with `read`, as the backend
 * answers after someone else saved. Returns the bodies saved.
 */
async function answerSettings(
  page: Page,
  save: (body: Saved, earlier: number) => { status: number; body: object },
  read?: object,
) {
  const sent: Saved[] = [];
  await page.route("**/api/matching/admin/settings", async (route) => {
    const request = route.request();
    if (request.method() !== "PUT") {
      return route.fulfill({ status: 200, json: read ?? stored });
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    const body = request.postDataJSON() as Saved;
    const answer = save(body, sent.length);
    sent.push(body);
    await route.fulfill({
      status: answer.status,
      contentType: answer.status >= 400 ? "application/problem+json" : "application/json",
      body: JSON.stringify(answer.body),
    });
  });
  return sent;
}

/** The backend's answer to a save it kept: what was sent, one version on, a ceiling left out as null. */
function kept(body: Saved) {
  return {
    status: 200,
    body: { ...body, runsPerDay: body.runsPerDay ?? null, version: body.version + 1 },
  };
}

async function openSettings(page: Page) {
  await page.goto("/admin/ai/matching");
  // The form answers typing once it is hydrated.
  await page.waitForLoadState("networkidle");
}

test.describe("admin matching settings", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the limits", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/ai/matching", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/ai/matching"))?.status()).toBe(404);
  });

  test("an operator reads the six limits, is told what a number may be, and saves a change", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const sent = await answerSettings(page, kept);
    await openSettings(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Matching");
    if (!isMobile) {
      // In the sidebar it stands after Search index, and is the page a person is on.
      const ai = page
        .getByRole("navigation", { name: "Admin navigation" })
        .getByRole("list", { name: "AI", exact: true });
      await expect(ai.getByRole("link")).toHaveText([
        "Providers",
        "Search index",
        "Matching",
        "Usage",
        "MCP",
      ]);
      await expect(ai.getByRole("link", { name: "Matching" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    // Three parts, six limits, each with the number that is stored.
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      "One run",
      "After an edit",
      "Runs per day",
    ]);
    // Two tabs, each a page of its own; this one is Limits.
    const tabs = page.getByRole("main").getByRole("navigation", { name: "Matching" });
    await expect(tabs.getByRole("link")).toHaveText(["Limits", "Feedback"]);
    await expect(tabs.getByRole("link", { name: "Limits" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(tabs.getByRole("link", { name: "Feedback" })).toHaveAttribute(
      "href",
      "/admin/ai/matching/feedback",
    );
    const limit = (name: string) => page.getByRole("textbox", { name, exact: true });
    const atOnce = limit("Solutions read at once");
    await expect(atOnce).toHaveValue("8");
    await expect(limit("Solutions per run")).toHaveValue("40");
    await expect(limit("Wait after the last edit")).toHaveValue("10");
    await expect(limit("Runs started by edits, per use case per day")).toHaveValue("3");
    await expect(limit("Runs a member may start, per use case per day")).toHaveValue("3");
    await expect(limit("Runs per day, whole platform")).toHaveValue("200");
    // A limit says what it may be and what it does to whoever hears the page instead of seeing it.
    await expect(atOnce).toHaveAccessibleDescription(/^1 to 16 More at once is faster/);
    await expect(limit("Runs per day, whole platform")).toHaveAccessibleDescription(
      /^1 to 100,000 A ceiling on cost.*Leave it empty for no ceiling\.$/,
    );

    // Nothing changed, nothing to save.
    const save = page.getByRole("button", { name: "Save changes" });
    await expect(save).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    // A number outside what the backend takes is refused beside its field and never sent.
    await atOnce.fill("17");
    await save.click();
    await expect(atOnce).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a whole number from 1 to 16.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    expect(sent).toHaveLength(0);

    // The stored number put back is no change.
    await atOnce.fill("8");
    await expect(page.getByText("Enter a whole number from 1 to 16.")).toHaveCount(0);
    await expect(save).toBeDisabled();

    // One changed number is saved with the others as they are and the version that was read.
    await atOnce.fill("12");
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await save.click();
    await expect(page.getByText("Matching settings saved.")).toBeVisible();
    expect(sent).toEqual([{ ...stored, parallel: 12 }]);
    await expect(atOnce).toHaveValue("12");
    await expect(save).toBeDisabled();

    // The next save sends the version the last one answered; an emptied ceiling is sent as none.
    // Enter saves as the button does; the toast of the first save may sit over the button meanwhile.
    await limit("Runs per day, whole platform").fill("");
    await limit("Runs per day, whole platform").press("Enter");
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toEqual({
      settleMinutes: 10,
      editRunsPerDay: 3,
      memberRunsPerDay: 3,
      candidates: 40,
      parallel: 12,
      version: 4,
    });
    await expect(limit("Runs per day, whole platform")).toHaveValue("");
    await expect(save).toBeDisabled();
  });

  test("a save on limits someone else changed meanwhile shows theirs and asks for the change again", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const theirs = { ...stored, candidates: 60, runsPerDay: null, version: 4 };
    const sent = await answerSettings(
      page,
      (body, earlier) =>
        earlier === 0
          ? { status: 409, body: { status: 409, code: "MATCHING_SETTINGS_CHANGED" } }
          : kept(body),
      theirs,
    );
    await openSettings(page);

    const limit = (name: string) => page.getByRole("textbox", { name, exact: true });
    const save = page.getByRole("button", { name: "Save changes" });
    await limit("Solutions read at once").fill("16");
    await save.click();

    // Their numbers replace what was typed, and the page says so until the person edits again.
    const told = page.getByText(
      "Someone else changed these settings while you were editing. The numbers below are theirs now. Make your change again, then save.",
    );
    await expect(told).toBeVisible();
    await expect(limit("Solutions read at once")).toHaveValue("8");
    await expect(limit("Solutions per run")).toHaveValue("60");
    await expect(limit("Runs per day, whole platform")).toHaveValue("");
    await expect(save).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    // The change made again is saved on their version.
    await limit("Solutions read at once").fill("16");
    await expect(told).toHaveCount(0);
    await save.click();
    await expect(page.getByText("Matching settings saved.")).toBeVisible();
    expect(sent.map((body) => [body.version, body.parallel, body.candidates])).toEqual([
      [3, 16, 40],
      [4, 16, 60],
    ]);
  });

  test("nobody but an operator gets the feedback", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/ai/matching/feedback", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/ai/matching/feedback"))?.status()).toBe(404);
  });

  test("switching tab with a limit unsaved asks first", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    await answerSettings(page, kept);
    await openSettings(page);
    const tabs = page.getByRole("main").getByRole("navigation", { name: "Matching" });

    await page.getByRole("textbox", { name: "Solutions read at once", exact: true }).fill("12");
    await tabs.getByRole("link", { name: "Feedback" }).click();
    const asking = page.getByRole("alertdialog", { name: "Leave without saving?" });
    await expect(asking).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    // Staying keeps the page and the number that was typed.
    await asking.getByRole("button", { name: "Stay" }).click();
    await expect(asking).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/ai\/matching$/);
    await expect(
      page.getByRole("textbox", { name: "Solutions read at once", exact: true }),
    ).toHaveValue("12");

    // Leaving opens the other tab.
    await tabs.getByRole("link", { name: "Feedback" }).click();
    await asking.getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/admin\/ai\/matching\/feedback$/);
    await expect(
      page
        .getByRole("main")
        .getByRole("navigation", { name: "Matching" })
        .getByRole("link", { name: "Feedback" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("an operator reads how often people agreed with the AI's groups, and each disagreement", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    // With nothing unsaved, the tab opens at once.
    await openSettings(page);
    await page
      .getByRole("main")
      .getByRole("navigation", { name: "Matching" })
      .getByRole("link", { name: "Feedback" })
      .click();
    await expect(page).toHaveURL(/\/admin\/ai\/matching\/feedback$/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    const said = page.getByRole("main");
    await expect(said.getByRole("heading", { level: 1 })).toHaveText("Matching");
    const tabs = said.getByRole("navigation", { name: "Matching" });
    await expect(tabs.getByRole("link", { name: "Feedback" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(tabs.getByRole("link", { name: "Limits" })).toHaveAttribute(
      "href",
      "/admin/ai/matching",
    );
    if (!isMobile) {
      // The sidebar has one entry for both tabs.
      await expect(
        page
          .getByRole("navigation", { name: "Admin navigation" })
          .getByRole("link", { name: "Matching" }),
      ).toHaveAttribute("aria-current", "page");
    }
    await expect(said.getByText("3 of 5 answers agreed in the last 30 days")).toBeVisible();
    await expect(said.getByText("2 disagreements")).toBeVisible();
    // A table from 768px, one stacked row an answer below that.
    const rows = isMobile
      ? said.locator('[data-slot="matching-disagreements"]').getByRole("listitem")
      : said
          .getByRole("table")
          .getByRole("row")
          .filter({ has: page.getByRole("cell") });
    await expect(rows).toHaveCount(2);
    if (!isMobile) {
      await expect(said.getByRole("columnheader")).toHaveText([
        "Solution",
        "AI's group",
        "Their group",
        "Requirements the AI got wrong",
        "Note",
        "Who and when",
      ]);
    }
    // A disagreement says the two groups, the requirements by name, the note, who and when. A
    // requirement of an earlier judgment is named by its place.
    const docbase = rows.filter({ hasText: "Docbase" });
    await expect(docbase.getByText("Claims triage")).toBeVisible();
    await expect(docbase.getByText("Right technology, less proof")).toBeVisible();
    await expect(docbase.getByText("Strong fit")).toBeVisible();
    await expect(docbase.getByText("Read documents, Requirement 2")).toBeVisible();
    await expect(docbase.getByText("They read claim forms for two insurers.")).toBeVisible();
    await expect(docbase.getByText("Minh Trần")).toBeVisible();
    await expect(docbase.locator("time")).toHaveAttribute("datetime", "2026-10-09T04:00:00Z");
    // One about a use case that is no longer published has nowhere to open.
    const peakflo = rows.filter({ hasText: "Peakflo" });
    await expect(peakflo.getByText("Not a fit")).toBeVisible();
    await expect(peakflo.getByRole("link")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // It links to the solutions matched to the use case, with that solution open, even where its group
    // would fold it away.
    const link = docbase.getByRole("link", { name: "Docbase" });
    await expect(link).toHaveAttribute(
      "href",
      "/admin/use-cases/0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011/candidates?solution=c4d1d47e-0000-4000-8000-000000000003",
    );
    await link.click();
    // On a phone the solution's sheet lies over the page, so the page is told by its address.
    await expect(page).toHaveURL(/\/candidates\?solution=c4d1d47e-0000-4000-8000-000000000003$/);
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Docbase" })).toBeVisible();
  });

  test("where nobody has answered, the feedback tab says so and lists nothing", async ({
    page,
    context,
    baseURL,
  }) => {
    // The operator of another deployment (tests/e2e/stub-matching.mjs).
    await signInAs(context, "emailer", baseURL!);
    await page.goto("/admin/ai/matching/feedback");

    const said = page.getByRole("main");
    await expect(said.getByText("Nobody has answered yet.")).toBeVisible();
    await expect(said.getByText(/answers agreed/)).toHaveCount(0);
    await expect(said.getByRole("table")).toHaveCount(0);
    await expect(said.locator('[data-slot="matching-disagreements"]')).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });
});
