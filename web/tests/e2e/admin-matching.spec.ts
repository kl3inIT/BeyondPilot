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
});
