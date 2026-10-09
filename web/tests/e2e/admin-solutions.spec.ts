import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, giveReason, refusal } from "./reviews";
import { signInAs } from "./session";
import { serveStoredImages } from "./stored-files";

const claimsCopilot = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e01";
const underwritingRadar = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e02";
const policyChat = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03";
const quoteBot = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e04";
const riskLens = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e05";
const waitingDeployment = "be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f01";
const approvedDeployment = "be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f02";

const decisionsPath = "**/api/solution/admin/**";

/** The ⋯ trigger of each solution shown, whichever layout the viewport has. */
function shownSolutions(page: Page) {
  return page.getByRole("button", { name: /^Open / });
}

/** The card of one customer deployment on a solution's record. */
function deploymentCard(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
}

test.describe("admin solutions", () => {
  test.beforeEach(({ page }) => serveStoredImages(page));

  test.use({ locale: "en-US" });

  test("nobody but an operator gets the list or a record", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/solutions", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Fsolutions");

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/solutions"))?.status()).toBe(404);
    expect((await page.goto(`/admin/solutions/${claimsCopilot}`))?.status()).toBe(404);
  });

  test("an operator sees every submitted solution, those that wait first and for how long", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/solutions");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solutions");
    // Each record opens from its row's ⋯ menu; the name itself is the link.
    await expect(shownSolutions(page)).toHaveCount(5);
    await expect(
      page.getByRole("link", { name: "Claims Copilot" }).and(page.locator(":visible")),
    ).toHaveAttribute("href", `/admin/solutions/${claimsCopilot}`);
    await expect(page.getByText("Sent 3 hours ago").and(page.locator(":visible"))).toHaveCount(1);
    await expect(page.getByText("1 deployment waits").and(page.locator(":visible"))).toHaveCount(1);
    await expect(page.getByText("5 solutions")).toBeVisible();
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);
  });

  test("search and the status are the address, and the server answers them", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/solutions");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "In review" }).click();
    await expect(page).toHaveURL(/status=in_review/);
    await expect(shownSolutions(page)).toHaveCount(2);
    await expect(page.getByText("2 solutions")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search by solution or organization" }).fill("quote");
    await expect(page).toHaveURL(/[?&]q=quote/);
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText(
      "No solution matches",
    );

    await page.getByRole("link", { name: "Clear search and filter" }).click();
    await expect(page).toHaveURL("/admin/solutions");
    await expect(shownSolutions(page)).toHaveCount(5);

    // A solution taken down is found under its own status.
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Taken down" }).click();
    await expect(page).toHaveURL(/status=suspended/);
    await expect(shownSolutions(page)).toHaveCount(1);
  });

  test("the queue is walked from its records: a decision opens the next that waits", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${claimsCopilot}`);

    await expect(page).toHaveTitle("Claims Copilot · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims Copilot");
    await expect(page.getByText("1 of 2 waiting")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Next in review: Underwriting Radar" }),
    ).toHaveAttribute("href", `/admin/solutions/${underwritingRadar}`);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("Claims Copilot is approved.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/solutions/${underwritingRadar}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Underwriting Radar");
    // After the last record the queue goes round to its first.
    await expect(page.getByText("2 of 2 waiting")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next in review: Claims Copilot" })).toBeVisible();
    expect(decisions).toEqual([
      { call: `POST /api/solution/admin/solutions/${claimsCopilot}/approve`, body: null },
    ]);
  });

  test("the keys decide once the page has been read, and never under a dialog", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "a phone has no keyboard to press keys on");
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${claimsCopilot}`);
    await expect(page.getByText("Keys: A approve · S send back")).toBeVisible();

    // A key pressed as the page arrives was meant for the page before it.
    await page.keyboard.press("a");
    // Keys act from the second second of a page on.
    await page.waitForTimeout(1100);
    expect(decisions).toEqual([]);

    await page.keyboard.press("s");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Send Claims Copilot back?");
    await page.keyboard.press("a");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(decisions).toEqual([]);

    await page.keyboard.press("n");
    await expect(page).toHaveURL(`/admin/solutions/${underwritingRadar}`);
  });

  test("a solution is not sent back without what to change, which reaches its owners", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${underwritingRadar}`);

    await page.getByRole("button", { name: "Send back…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Send Underwriting Radar back?");
    await expect(dialog.getByRole("button", { name: "Send back" })).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    await dialog
      .getByRole("textbox", { name: "What to change" })
      .fill(" Name the pilot customer. ");
    await dialog.getByRole("button", { name: "Send back" }).click();

    await expect(page.getByText("Underwriting Radar sent back with what to change.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/solutions/${claimsCopilot}`);
    expect(decisions).toEqual([
      {
        call: `POST /api/solution/admin/solutions/${underwritingRadar}/send-back`,
        body: { reason: "Name the pilot customer." },
      },
    ]);
  });

  test("a solution is rejected for good with a reason that is not missing information", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${underwritingRadar}`);

    await page.getByRole("button", { name: "Reject…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Reject Underwriting Radar for good?");
    await expect(dialog.getByRole("option", { name: "Information is missing" })).toHaveCount(0);

    await giveReason(page, "Already listed", "Listed as Policy Chat.");
    await dialog.getByRole("button", { name: "Reject" }).click();

    await expect(page.getByText("Underwriting Radar is rejected.")).toBeVisible();
    expect(decisions).toEqual([
      {
        call: `POST /api/solution/admin/solutions/${underwritingRadar}/reject`,
        body: { reason: "duplicate", message: "Listed as Policy Chat." },
      },
    ]);
  });

  test("an approved solution can only be taken down, and stays on its record", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${policyChat}`);

    // It does not wait, so it has no place in the queue; the queue's first record is still offered.
    await expect(page.getByText(/of 2 waiting/)).toHaveCount(0);
    await expect(page.getByText("Key: S take down")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the public page" })).toHaveAttribute(
      "href",
      "/solutions/policy-chat",
    );
    // The solution's own decision stands before those of its customer deployments.
    await page.getByRole("button", { name: "Take down…" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Take Policy Chat down?");

    await giveReason(page, "Misleading information", "");
    await dialog.getByRole("button", { name: "Take down" }).click();

    await expect(page.getByText("Policy Chat is taken down.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/solutions/${policyChat}`);
    expect(decisions).toEqual([
      {
        call: `POST /api/solution/admin/solutions/${policyChat}/take-down`,
        body: { reason: "misleading_information", message: null },
      },
    ]);
  });

  test("a solution taken down says why and is restored without a new review", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${riskLens}`);

    await expect(page.getByText("Taken down: Misleading information.")).toBeVisible();
    await expect(page.getByText("The customers named are not real.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the public page" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Take down…" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Put Risk Lens back?");
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Restore" }).click();

    await expect(page.getByText("Risk Lens is back.")).toBeVisible();
    expect(decisions).toEqual([
      { call: `POST /api/solution/admin/solutions/${riskLens}/restore`, body: null },
    ]);
  });

  test("a customer deployment is approved, sent back or taken down on its solution's record", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/solutions/${policyChat}`);

    const waiting = deploymentCard(page, "Claims line at Bảo An");
    await expect(waiting.getByText("A regional insurer · In production")).toBeVisible();
    await waiting.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Claims line at Bảo An approved.")).toBeVisible();

    await waiting.getByRole("button", { name: "Send back…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Send Claims line at Bảo An back?");
    await giveReason(page, "Could not be verified", "Who can confirm it?");
    await dialog.getByRole("button", { name: "Send back" }).click();
    await expect(page.getByText("Claims line at Bảo An sent back.")).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // An approved one has no approval left to give.
    const approved = deploymentCard(page, "Renewals at Mekong Life");
    await expect(approved.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await approved.getByRole("button", { name: "Take down…" }).click();
    await expect(dialog.getByRole("heading")).toHaveText("Take Renewals at Mekong Life down?");
    await giveReason(page, "Information is missing", "");
    await dialog.getByRole("button", { name: "Take down" }).click();
    await expect(page.getByText("Renewals at Mekong Life sent back.")).toBeVisible();

    expect(decisions).toEqual([
      { call: `POST /api/solution/admin/deployments/${waitingDeployment}/approve`, body: null },
      {
        call: `POST /api/solution/admin/deployments/${waitingDeployment}/reject`,
        body: { reason: "unverifiable", message: "Who can confirm it?" },
      },
      {
        call: `POST /api/solution/admin/deployments/${approvedDeployment}/reject`,
        body: { reason: "incomplete", message: null },
      },
    ]);
  });

  test("a decision the backend refuses is told in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerDecisions(page, decisionsPath, 409, refusal("SOLUTION_NOT_AWAITING_REVIEW"));
    await page.goto(`/admin/solutions/${claimsCopilot}`);

    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("This solution has already been reviewed.")).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    // The record stays, and the decision can be made again.
    await expect(page).toHaveURL(`/admin/solutions/${claimsCopilot}`);
    await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  test("a rejected solution's record says why and offers no decision", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/solutions/${quoteBot}`);

    await expect(page.getByText("Rejected: Already listed.")).toBeVisible();
    await expect(page.getByText("It is Policy Chat under another name.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send back…" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject…" })).toHaveCount(0);

    expect((await page.goto("/admin/solutions/no-such-record"))?.status()).toBe(404);
  });
});
