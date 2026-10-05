import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, giveReason, refusal } from "./reviews";
import { signInAs } from "./session";

const bao = "cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a01";
const mai = "cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a02";
const arif = "cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a03";
const siti = "cf7c9ab8-6f64-4ab9-9ab1-6d9f2f2b3a04";

const decisionsPath = "**/api/talent/admin/**";

/** The profiles shown, by the name each row leads with, whichever layout the viewport has. */
function shownProfiles(page: Page) {
  return page.locator('[data-slot="person"]:visible >> span.font-medium');
}

test.describe("admin talent", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the list or a record", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/talent", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Ftalent");

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/talent"))?.status()).toBe(404);
    expect((await page.goto(`/admin/talent/${bao}`))?.status()).toBe(404);
  });

  test("an operator sees every submitted profile, those that wait first and for how long", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/talent");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Talent");
    await expect(shownProfiles(page)).toHaveText([
      "Bảo Trần",
      "Mai Phạm",
      "Arif Hidayat",
      "Siti Rahma",
    ]);
    await expect(page.getByRole("link", { name: /^Open / })).toHaveText([
      "Review",
      "Review",
      "Open",
      "Open",
    ]);
    await expect(page.getByText("Sent 5 hours ago").and(page.locator(":visible"))).toHaveCount(1);
    await expect(page.getByText("4 profiles")).toBeVisible();
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
    await page.goto("/admin/talent");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Approved" }).click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(shownProfiles(page)).toHaveText(["Arif Hidayat"]);

    await page.getByRole("searchbox", { name: "Search by name or email" }).fill("mai.pham");
    await expect(page).toHaveURL(/[?&]q=mai\.pham/);
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText(
      "No profile matches",
    );

    await page.getByRole("link", { name: "Clear search and filter" }).click();
    await expect(page).toHaveURL("/admin/talent");
    await expect(shownProfiles(page)).toHaveCount(4);
  });

  test("the queue is walked from its records: a decision opens the next that waits", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/talent/${bao}`);

    await expect(page).toHaveTitle("Bảo Trần · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bảo Trần");
    // The account's address is the operator's to see; the public profile never shows it.
    await expect(page.getByText("bao.tran@example.com")).toBeVisible();
    await expect(page.getByText("1 of 2 waiting")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("Bảo Trần is approved.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/talent/${mai}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mai Phạm");
    await expect(page.getByText("2 of 2 waiting")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next in review: Bảo Trần" })).toBeVisible();
    expect(decisions).toEqual([
      { call: `POST /api/talent/admin/profiles/${bao}/approve`, body: null },
    ]);
  });

  test("a profile is not sent back without a reason, and carries the note to its person", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/talent/${mai}`);

    await page.getByRole("button", { name: "Send back…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Send Mai Phạm back?");
    await expect(dialog.getByRole("button", { name: "Send back" })).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    await giveReason(page, "Experience could not be verified", "Link one shipped project.");
    await dialog.getByRole("button", { name: "Send back" }).click();

    await expect(page.getByText("Mai Phạm sent back with your reason.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/talent/${bao}`);
    expect(decisions).toEqual([
      {
        call: `POST /api/talent/admin/profiles/${mai}/reject`,
        body: { reason: "unverifiable", message: "Link one shipped project." },
      },
    ]);
  });

  test("an approved profile can only be taken down, and stays on its record", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/talent/${arif}`);

    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open the public page" })).toHaveAttribute(
      "href",
      "/talent/arif-hidayat",
    );
    await page.getByRole("button", { name: "Take down…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Take Arif Hidayat down?");

    await giveReason(page, "Content does not belong here", "");
    await dialog.getByRole("button", { name: "Take down" }).click();

    await expect(page.getByText("Arif Hidayat sent back with your reason.")).toBeVisible();
    await expect(page).toHaveURL(`/admin/talent/${arif}`);
    expect(decisions).toEqual([
      {
        call: `POST /api/talent/admin/profiles/${arif}/reject`,
        body: { reason: "inappropriate", message: null },
      },
    ]);
  });

  test("a decision the backend refuses is told in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerDecisions(page, decisionsPath, 409, refusal("TALENT_NOT_AWAITING_REVIEW"));
    await page.goto(`/admin/talent/${bao}`);

    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("This profile has already been reviewed.")).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    await expect(page).toHaveURL(`/admin/talent/${bao}`);
    await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  test("a rejected profile's record says why and offers no decision", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/talent/${siti}`);

    await expect(page.getByText("Changes needed: Information is missing.")).toBeVisible();
    await expect(page.getByText("Add a project.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send back…" })).toHaveCount(0);

    expect((await page.goto("/admin/talent/no-such-record"))?.status()).toBe(404);
  });
});
