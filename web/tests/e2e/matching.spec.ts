import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

// Two published use cases of Pocket Policy and what is matched to them (tests/e2e/stub-matching.mjs):
// "Claims triage" asks for three things, "Invoice capture" for one, as most use cases do.
const useCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011";
const oneNeedUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0021";
const memberPath = `/workspace/organization/use-cases/${useCaseId}/candidates`;
const oneNeedPath = `/workspace/organization/use-cases/${oneNeedUseCaseId}/candidates`;
const adminPath = `/admin/use-cases/${useCaseId}/candidates`;
const candidateId = (number: number) => `c4d1d47e-0000-4000-8000-00000000000${number}`;

// Where the stub backend of this run answers (playwright.config.ts).
const stubOrigin = "http://localhost:3190";

type Candidate = Record<string, unknown> & { solutionName: string };
type Matching = Record<string, unknown> & { candidates: Candidate[] };

/**
 * The state the page read, as the stub answers the account. A request the browser sends is answered
 * by the test with this state changed, the way the backend answers every request with the whole state.
 */
async function matchingAs(request: APIRequestContext, account: "owner" | "operator") {
  const answer = await request.get(`${stubOrigin}/api/matching/use-cases/${useCaseId}`, {
    headers: { Cookie: `BEYONDPILOT_SESSION=${account}` },
  });
  return (await answer.json()) as Matching;
}

/** The state with one solution changed. */
function withCandidate(state: Matching, name: string, change: Record<string, unknown>): Matching {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.solutionName === name ? { ...candidate, ...change } : candidate,
    ),
  };
}

const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const rowName = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
/** The header of the last group, which folds: its name and how many it holds. */
const lastGroupHeader = (page: Page) =>
  page.getByRole("button", { name: /^Right technology, less proof\s*\d+$/ });

test.describe("solutions matched to a use case", () => {
  test.use({ locale: "en-US" });

  test("a member reads the groups and one solution in full", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims triage");
    const pages = page.getByRole("navigation", { name: "Pages of this use case" });
    await expect(pages.getByRole("link", { name: "Matched solutions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pages.getByRole("link", { name: "Brief" })).toHaveAttribute(
      "href",
      `/workspace/organization/use-cases/${useCaseId}`,
    );

    // A use case that asks for several things says what the solutions cover together, in words.
    await expect(
      page.getByText("Together they cover 2 of the 3 things you asked for"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "No solution on BeyondPilot shows it can do: Routes a claim to the right approver",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "AI read each vendor's public material and picked these. Check before you decide.",
      ),
    ).toHaveCount(1);
    // What the AI put in no group is not shown.
    await expect(page.getByText("OmniShelf")).toHaveCount(0);

    // Each group is a named region under a second-level heading, with what it means printed under it.
    for (const [name, about] of [
      ["Strong fit", "They show they do what you asked for."],
      [
        "Experience in your industry",
        "They have done similar work in your industry, but show only part of what you asked for.",
      ],
      [
        "Right technology, less proof",
        "They use the technology you named, but show only part of what you asked for.",
      ],
      ["Not reviewed yet", "GenAI Fund added these by hand. AI reads them in the next run."],
    ]) {
      await expect(group(page, name).getByRole("heading", { level: 2 })).toContainText(name);
      await expect(group(page, name).getByText(about)).toBeVisible();
    }

    // A member has a number of runs a day, and none of the operators' actions.
    await expect(page.getByText("2 runs left today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Look for new solutions" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);

    // A row says the AI's sentence and where the solution is from. The vendor's words are in the panel.
    const staple = row(page, "Staple AI");
    await expect(staple.getByText("It reads claim documents in production today.")).toBeVisible();
    await expect(staple.getByText("Singapore · In production")).toBeVisible();
    await expect(staple.getByText("Website could not be read")).toBeVisible();
    await expect(staple.getByText("extracts and verifies the content")).toHaveCount(0);
    await expect(staple.getByRole("button", { name: "Add to shortlist" })).toBeVisible();
    await expect(row(page, "Kira Claims").getByText("Added by GenAI Fund")).toBeVisible();

    // The last group shows its header alone until it is opened.
    await expect(rowName(page, "Docbase")).toHaveCount(0);
    await expect(lastGroupHeader(page)).toHaveAttribute("aria-expanded", "false");
    await lastGroupHeader(page).click();
    await expect(rowName(page, "Docbase")).toBeVisible();

    // Beside the list from 1280px; in a sheet that opens when a row is chosen below that.
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();
    await expect(panel.getByText("Singapore · In production")).toBeVisible();
    await expect(panel.getByRole("link", { name: "View solution profile" })).toHaveAttribute(
      "href",
      "/solutions/staple-ai",
    );
    await expect(panel.getByText("Strong fit", { exact: true })).toBeVisible();
    await expect(panel.getByText("AI summary", { exact: true })).toBeVisible();
    await expect(panel.getByText("It reads claim documents in production today.")).toBeVisible();
    await expect(panel.getByText(/^AI could not read their website/)).toBeVisible();

    // Each thing asked for in full, with the verdict in words, the AI's reason and the vendor's words.
    await expect(
      panel.getByRole("heading", { level: 3, name: "What you asked for, and what they show" }),
    ).toBeVisible();
    await expect(
      panel.getByText("Reads claim forms and invoices and takes out their fields"),
    ).toBeVisible();
    await expect(panel.getByText("Must have", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Shown", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Partly shown", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("No evidence found", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("It flags, it does not check rules.")).toBeVisible();
    await expect(panel.getByText("flags unusual invoices")).toBeVisible();
    await expect(panel.getByText("From their deck, page 6")).toBeVisible();
    await expect(panel.getByText("From their website", { exact: true })).toBeVisible();

    // The conditions of delivery wait behind a disclosure that says how many there are.
    await expect(
      panel.getByRole("heading", { level: 3, name: "Ask the vendor about these" }),
    ).toBeVisible();
    await expect(panel.getByText("SAP connector available")).toHaveCount(0);
    await panel.getByRole("button", { name: "1 delivery condition to ask about" }).click();
    await expect(panel.getByText("SAP connector available")).toBeVisible();
    await expect(panel.getByText("From their BeyondPilot profile")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Add to shortlist" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Not a fit…" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await expect(panel.getByRole("button", { name: "Previous solution" })).toBeDisabled();
    await panel.getByRole("button", { name: "Next solution" }).click();
    await expect(panel.getByRole("heading", { name: "Sentosa Finance" })).toBeVisible();
    await expect(panel.getByText("Indonesia · At scale")).toBeVisible();
    await expect(panel.getByText("Experience in your industry", { exact: true })).toBeVisible();
  });

  test("a use case that asks for one thing reads as one sentence, and its last group folds", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(oneNeedPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Invoice capture");
    await expect(
      page.getByText("8 solutions match. 1 does exactly what you asked for."),
    ).toBeVisible();
    await expect(
      page.getByText("You asked for: Reads claim forms and invoices and takes out their fields"),
    ).toBeVisible();
    // Nothing to filter by, and no line on what they cover together.
    await expect(page.getByRole("group", { name: "Filter by what you asked for" })).toHaveCount(0);
    await expect(page.getByText(/^Together they cover/)).toHaveCount(0);

    // The first two groups show every row.
    await expect(group(page, "Strong fit").getByRole("listitem")).toHaveCount(1);
    await expect(group(page, "Experience in your industry").getByRole("listitem")).toHaveCount(1);
    const staple = row(page, "Staple AI");
    await expect(staple.getByText("It reads invoices in production today.")).toBeVisible();
    await expect(staple.getByText("Deck could not be read")).toBeVisible();
    // The group says what the row would say, so the row does not repeat it.
    await expect(staple.getByText("Shown", { exact: true })).toHaveCount(0);
    await expect(row(page, "Sentosa Finance").getByText("Partly shown")).toHaveCount(0);

    // The last group: its header alone, then five rows, then all six.
    const last = group(page, "Right technology, less proof");
    await expect(last.getByRole("heading", { level: 2 })).toContainText("6");
    await expect(
      last.getByText(
        "They use the technology you named, but show only part of what you asked for.",
      ),
    ).toBeVisible();
    await expect(last.getByRole("listitem")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await lastGroupHeader(page).click();
    await expect(lastGroupHeader(page)).toHaveAttribute("aria-expanded", "true");
    await expect(last.getByRole("listitem")).toHaveCount(5);
    await last.getByRole("button", { name: "Show 1 more" }).click();
    await expect(last.getByRole("listitem")).toHaveCount(6);
    await expect(last.getByRole("button", { name: "Show fewer" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("what was asked for narrows the list, and a thing nobody shows says so", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    const filter = page.getByRole("group", { name: "Filter by what you asked for" });
    await expect(filter.getByRole("button", { name: "Any", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await filter.getByRole("button", { name: "Check rules 2" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toBeVisible();
    await expect(group(page, "Right technology, less proof")).toHaveCount(0);

    await filter.getByRole("button", { name: "Approval flow 0" }).click();
    await expect(
      page.getByText("No solution here shows it can do: Routes a claim to the right approver"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show all solutions" }).click();
    await expect(group(page, "Right technology, less proof")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a member adds a solution to the shortlist", async ({ page, context, baseURL, request }) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const asked: string[] = [];
    await page.route("**/api/matching/candidates/*/shortlist", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      asked.push(new URL(route.request().url()).pathname);
      await route.fulfill({
        json: withCandidate(state, "Staple AI", { decision: "shortlisted" }),
      });
    });
    await page.goto(memberPath);

    await page.getByRole("tab", { name: "Shortlist 0" }).click();
    await expect(
      page.getByText("Your shortlist is empty. Add the solutions you want to talk to."),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Matches 4" }).click();

    const staple = row(page, "Staple AI");
    await staple.getByRole("button", { name: "Add to shortlist" }).click();

    await expect(page.getByText("Staple AI is on your shortlist.")).toBeVisible();
    expect(asked).toEqual([`/api/matching/candidates/${candidateId(1)}/shortlist`]);
    await expect(staple.getByRole("button", { name: "On shortlist" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("tab", { name: "Shortlist 1" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a member removes a solution with a reason, and the Removed tab says who and why", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const sent: unknown[] = [];
    await page.route("**/api/matching/candidates/*/remove", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      expect(new URL(route.request().url()).pathname).toBe(
        `/api/matching/candidates/${candidateId(3)}/remove`,
      );
      sent.push(route.request().postDataJSON());
      await route.fulfill({
        json: withCandidate(state, "Docbase", {
          decision: "removed",
          removedReason: "wrong_industry_or_size",
          removedNote: "too small for us",
          removedBy: "Minh Trần",
          removedByOperator: false,
          removedAt: "2026-10-09T02:00:00Z",
        }),
      });
    });
    await page.goto(memberPath);

    // The row folds in place into the reasons; nothing is removed without one, and the note is optional.
    await lastGroupHeader(page).click();
    await page.getByRole("button", { name: "More for Docbase" }).click();
    await page.getByRole("menuitem", { name: "Not a fit…" }).click();
    const picker = page.getByRole("region", { name: "Why is Docbase not a fit?" });
    const confirm = picker.getByRole("button", { name: "Remove", exact: true });
    await expect(confirm).toBeDisabled();
    await picker.getByRole("button", { name: "Wrong industry or company size" }).click();
    await expect(confirm).toBeEnabled();
    await expect(
      picker.getByText("We won't suggest it for this use case again. It stays on BeyondPilot."),
    ).toBeVisible();
    await picker.getByRole("textbox", { name: "Add a note (optional)" }).fill("too small for us");
    await expectNoSeriousA11yViolations(page);
    await confirm.click();

    await expect(page.getByText("Docbase removed · Wrong industry or company size")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    expect(sent).toEqual([{ reason: "wrong_industry_or_size", note: "too small for us" }]);
    await expect(rowName(page, "Docbase")).toHaveCount(0);

    // The Removed tab is the chosen one, alone, and its list has no panel beside it.
    await page.getByRole("tab", { name: "Removed 3" }).click();
    await expect(page.getByRole("tab", { name: "Removed 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { selected: true })).toHaveCount(1);
    await expect(page.getByRole("complementary", { name: "The solution you picked" })).toHaveCount(
      0,
    );
    const removed = page.getByRole("tabpanel").getByRole("listitem");
    const docbase = removed.filter({ hasText: "Docbase" });
    await expect(
      docbase.getByText("Wrong industry or company size · too small for us"),
    ).toBeVisible();
    await expect(docbase.getByText(/^Removed by Minh Trần · /)).toBeVisible();
    await expect(docbase.getByRole("button", { name: "Restore" })).toBeVisible();

    // What GenAI Fund removed, a member reads and cannot restore.
    const fintelite = removed.filter({ hasText: "Fintelite" });
    await expect(fintelite.getByText("Does not solve this problem")).toBeVisible();
    await expect(fintelite.getByText(/^Removed by GenAI Fund · /)).toBeVisible();
    await expect(
      fintelite.getByText("GenAI Fund removed it, so only GenAI Fund can restore it."),
    ).toBeVisible();
    await expect(fintelite.getByRole("button", { name: "Restore" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a member is asked before a run, which is one of the few the day allows", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const sent: unknown[] = [];
    await page.route("**/api/matching/use-cases/*/runs", async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ json: state });
    });
    await page.goto(memberPath);

    await page.getByRole("button", { name: "Look for new solutions" }).click();
    const asking = page.getByRole("alertdialog", { name: "Look for solutions now?" });
    await expect(asking.getByText("This uses 1 of your 2 runs left today.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    expect(sent).toEqual([]);

    await asking.getByRole("button", { name: "Look for new solutions" }).click();
    await expect(page.getByText("Looking for solutions.")).toBeVisible();
    expect(sent).toEqual([{ judgeAll: false }]);
    await expect(asking).toHaveCount(0);
  });

  test("an operator looks again without being asked, and finds the rest under More", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const state = await matchingAs(request, "operator");
    const sent: { runs: unknown[]; added?: unknown; search?: string | null } = { runs: [] };
    await page.route("**/api/matching/use-cases/*/runs", async (route) => {
      sent.runs.push(route.request().postDataJSON());
      await route.fulfill({ json: state });
    });
    await page.route("**/api/matching/use-cases/*/candidates", async (route) => {
      sent.added = route.request().postDataJSON();
      await route.fulfill({ json: state });
    });
    await page.route(/\/api\/solution\/admin\/solutions\?/, async (route) => {
      sent.search = new URL(route.request().url()).searchParams.get("status");
      const solution = (id: string, name: string) => ({
        id,
        name,
        slug: name.toLowerCase(),
        organizationName: `${name} Pte`,
        status: "approved",
        listed: true,
        industries: ["insurance"],
        maturity: "pilot",
        deploymentsAwaitingReview: 0,
      });
      await route.fulfill({
        json: {
          items: [
            solution("50101000-0000-4000-8000-000000000001", "Staple AI"),
            solution("50101000-0000-4000-8000-000000000099", "Newcomer"),
          ],
          page: 1,
          pageSize: 25,
          total: 2,
          awaitingReview: 0,
          deploymentsAwaitingReview: 0,
        },
      });
    });
    await page.goto(adminPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims triage");
    await expect(page.getByText("Pocket Policy", { exact: true })).toBeVisible();
    // An operator reads how many solutions the AI read and with which model, and has no number of runs.
    await expect(
      page.getByText(/^Updated .+ · AI read 6 solutions closely · model claude-sonnet-4-5$/),
    ).toBeVisible();
    await expect(page.getByText(/left today/)).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // One visible action, which an operator is not asked about.
    await page.getByRole("button", { name: "Look for new solutions" }).click();
    await expect(page.getByText("Looking for solutions.")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(sent.runs).toEqual([{ judgeAll: false }]);

    // The operators' two actions are in the More menu.
    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    await expect(page.getByRole("menuitem", { name: "Add one by hand" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Re-review every solution" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("menuitem", { name: "Re-review every solution" }).click();
    const asking = page.getByRole("alertdialog", { name: "Re-review every solution?" });
    await asking.getByRole("button", { name: "Re-review every solution" }).click();
    await expect(page.getByText("AI is reading every solution again.")).toBeVisible();
    expect(sent.runs).toEqual([{ judgeAll: false }, { judgeAll: true }]);
    await expect(asking).toHaveCount(0);

    await more.click();
    await page.getByRole("menuitem", { name: "Add one by hand" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a solution by hand" });
    const known = dialog.getByRole("listitem").filter({ hasText: "Staple AI" });
    await expect(known.getByText("Already on the list")).toBeVisible();
    await expect(known.getByRole("button")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Add Newcomer" }).click();
    await expect(page.getByText("Newcomer added. AI reads it in the next run.")).toBeVisible();
    expect(sent.search).toBe("approved");
    expect(sent.added).toEqual({ solutionId: "50101000-0000-4000-8000-000000000099" });
    await expect(dialog).toHaveCount(0);

    // What GenAI Fund removed, an operator restores.
    await page.getByRole("tab", { name: "Removed 2" }).click();
    const fintelite = page
      .getByRole("tabpanel")
      .getByRole("listitem")
      .filter({ hasText: "Fintelite" });
    await expect(fintelite.getByRole("button", { name: "Restore" })).toBeVisible();
  });
});
