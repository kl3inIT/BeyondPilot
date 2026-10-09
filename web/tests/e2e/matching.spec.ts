import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

// The published use case "Claims triage" of Pocket Policy and what is matched to it
// (tests/e2e/stub-matching.mjs).
const useCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011";
const memberPath = `/workspace/organization/use-cases/${useCaseId}/candidates`;
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

/** The state with one candidate changed. */
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

test.describe("candidates of a use case", () => {
  test.use({ locale: "en-US" });

  test("a member reads the three groups and one candidate in full", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims triage");
    const pages = page.getByRole("navigation", { name: "Pages of this use case" });
    await expect(pages.getByRole("link", { name: "Candidates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pages.getByRole("link", { name: "Brief" })).toHaveAttribute(
      "href",
      `/workspace/organization/use-cases/${useCaseId}`,
    );

    // What a run judged into no group is not shown, and is not counted.
    await expect(page.getByText("3 recommended · they cover 2 of 3 needs")).toBeVisible();
    await expect(page.getByText("Nobody on BeyondPilot shows Approval flow")).toBeVisible();
    await expect(page.getByText("OmniShelf")).toHaveCount(0);
    for (const name of [
      "Direct relevance",
      "Industry relevance",
      "Technology capability",
      "Waiting to be judged",
    ]) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }

    // A member has a number of runs a day, and none of the operators' actions.
    await expect(page.getByText("2 runs left today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run again" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Add a solution" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Judge all again" })).toHaveCount(0);

    const staple = row(page, "Staple AI");
    await expect(staple.getByText("Singapore · In production")).toBeVisible();
    await expect(staple.getByText("extracts and verifies the content")).toBeVisible();
    await expect(staple.getByText("Website", { exact: true })).toBeVisible();
    await expect(row(page, "Kira Claims").getByText("Added by GenAI Fund")).toBeVisible();

    // Beside the list from 1024px; in a sheet that opens when a row is chosen below that.
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The chosen solution" });
    await expect(panel.getByRole("heading", { name: "Staple AI" })).toBeVisible();
    await expect(
      panel.getByText("Direct relevance · It reads claim documents in production today."),
    ).toBeVisible();
    await expect(panel.getByText("Met", { exact: true })).toHaveCount(2);
    await expect(panel.getByText("Partly", { exact: true })).toBeVisible();
    await expect(panel.getByText("Not shown", { exact: true })).toBeVisible();
    await expect(panel.getByText("Deck, page 6")).toBeVisible();
    await expect(panel.getByText("It flags, it does not check rules.")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "To confirm with the vendor" })).toBeVisible();
    await expect(panel.getByText("SAP connector available")).toBeVisible();
    await expect(panel.getByText(/^Its website held no text/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await expect(panel.getByRole("button", { name: "Previous solution" })).toBeDisabled();
    await panel.getByRole("button", { name: "Next solution" }).click();
    await expect(panel.getByRole("heading", { name: "Sentosa Finance" })).toBeVisible();
    await expect(panel.getByText("Indonesia · At scale")).toBeVisible();
  });

  test("a need narrows the list, and a need nobody shows says so", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    const needs = page.getByRole("group", { name: "Narrow by need" });
    await expect(needs.getByRole("button", { name: "All 4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await needs.getByRole("button", { name: "Check rules 2" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toBeVisible();
    await expect(rowName(page, "Docbase")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Technology capability" })).toHaveCount(0);

    await needs.getByRole("button", { name: "Approval flow 0" }).click();
    await expect(page.getByText("No solution here shows Approval flow.")).toBeVisible();
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(rowName(page, "Docbase")).toBeVisible();
  });

  test("a member shortlists a candidate", async ({ page, context, baseURL, request }) => {
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

    const staple = row(page, "Staple AI");
    await staple.getByRole("button", { name: "Shortlist", exact: true }).click();

    await expect(page.getByText("Staple AI is on the shortlist.")).toBeVisible();
    expect(asked).toEqual([`/api/matching/candidates/${candidateId(1)}/shortlist`]);
    await expect(staple.getByRole("button", { name: "Shortlisted" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("tab", { name: "Shortlist 1" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toHaveCount(0);
  });

  test("a member removes a candidate with a reason, and the Removed tab says who and why", async ({
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

    // The row folds in place into the reasons; nothing is removed without one.
    await page.getByRole("button", { name: "More for Docbase" }).click();
    await page.getByRole("menuitem", { name: "Remove…" }).click();
    const picker = page.getByRole("region", { name: "Why is Docbase not a fit?" });
    const confirm = picker.getByRole("button", { name: "Remove", exact: true });
    await expect(confirm).toBeDisabled();
    await picker.getByRole("button", { name: "Wrong industry or size" }).click();
    await picker.getByRole("textbox", { name: "Add a note (optional)" }).fill("too small for us");
    await expectNoSeriousA11yViolations(page);
    await confirm.click();

    await expect(page.getByText("Docbase removed · Wrong industry or size")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    expect(sent).toEqual([{ reason: "wrong_industry_or_size", note: "too small for us" }]);
    await expect(rowName(page, "Docbase")).toHaveCount(0);

    await page.getByRole("tab", { name: "Removed 3" }).click();
    const removed = page.getByRole("tabpanel").getByRole("listitem");
    const docbase = removed.filter({ hasText: "Docbase" });
    await expect(docbase.getByText("Wrong industry or size · too small for us")).toBeVisible();
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

  test("an operator has every candidate judged again and adds a solution by hand", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const state = await matchingAs(request, "operator");
    const sent: Record<string, unknown> = {};
    await page.route("**/api/matching/use-cases/*/runs", async (route) => {
      sent.run = route.request().postDataJSON();
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
    await expect(page.getByText(/claude-sonnet-4-5$/)).toBeVisible();
    // An operator has no number of runs a day.
    await expect(page.getByText(/left today/)).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Judge all again" }).click();
    const asking = page.getByRole("alertdialog", { name: "Judge every candidate again?" });
    await asking.getByRole("button", { name: "Judge all again" }).click();
    await expect(page.getByText("Every candidate is being judged again.")).toBeVisible();
    expect(sent.run).toEqual({ judgeAll: true });

    await page.getByRole("button", { name: "Add a solution" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a solution" });
    const known = dialog.getByRole("listitem").filter({ hasText: "Staple AI" });
    await expect(known.getByText("Already a candidate")).toBeVisible();
    await expect(known.getByRole("button")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Add Newcomer" }).click();
    await expect(page.getByText("Newcomer added. The run that follows judges it.")).toBeVisible();
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
