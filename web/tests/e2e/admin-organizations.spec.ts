import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, giveReason, refusal } from "./reviews";
import { signInAs } from "./session";

const lumen = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c01";
const openKitchen = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c02";
const pocketPolicy = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03";
const firstcall = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c04";
const quietMill = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c06";
const harborBank = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c07";
const firstTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a30";
const secondTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a31";
const thirdTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a32";
const invitation = "7d5a7e96-4d42-4e97-9e99-4b7dad0f1e01";
const claim = "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d01";

const decisionsPath = "**/api/organization/admin/**";

/** The organizations shown, by the name each row leads with, whichever layout the viewport has. */
function shownOrganizations(page: Page) {
  return page.locator('[data-slot="person"]:visible >> span.font-medium');
}

/**
 * Opens the review of the organization that waits, from the menu of its row. The dialog reads the
 * record from the browser, which the test answers.
 */
async function openReview(page: Page) {
  await page.route(`**/api/organization/admin/organizations/${lumen}`, (route) =>
    route.fulfill({
      json: {
        createdBy: "Linh Nguyễn",
        suggestedDomain: "lumenhealth.example",
        organization: { website: "https://lumenhealth.example" },
        claims: [],
      },
    }),
  );
  await page.goto("/admin/organizations");
  await page.getByRole("button", { name: "Actions for Lumen Health" }).click();
  await page.getByRole("menuitem", { name: "Review…" }).click();
  return page.getByRole("dialog");
}

/** Answers the record the claim's dialog reads from the browser: who asks, and the domain to confirm. */
async function answerClaimRecord(page: Page) {
  await page.route(`**/api/organization/admin/organizations/${openKitchen}`, (route) =>
    route.fulfill({
      json: {
        suggestedDomain: "openkitchen.example",
        claims: [
          {
            id: claim,
            name: "Arif Hidayat",
            email: "arif@openkitchen.example",
            message: "I founded the team.",
            createdAt: "2026-10-01T03:00:00Z",
          },
        ],
      },
    }),
  );
}

test.describe("admin organizations", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the list or a record", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/organizations", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Forganizations");

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/organizations"))?.status()).toBe(404);
    expect((await page.goto(`/admin/organizations/${lumen}`))?.status()).toBe(404);
  });

  test("an operator sees every organization, the one that waits first, with what it asks", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organisations");
    await expect(shownOrganizations(page)).toHaveText([
      "Lumen Health",
      "Open Kitchen",
      "Pocket Policy",
      "Firstcall",
      "Quiet Mill",
      "Harbor Bank",
    ]);
    await expect(page.getByText("6 organisations")).toBeVisible();
    // Each row is in the page twice, as a table row and as a stacked one; the viewport shows one.
    const shown = page.locator(":visible");
    await expect(page.getByText("Company · Singapore · 2 members").and(shown)).toHaveCount(1);
    await expect(page.getByText("Builder team · Vietnam · No owner").and(shown)).toHaveCount(1);
    await expect(page.getByText("New organization", { exact: true }).and(shown)).toHaveCount(1);
    await expect(page.getByText("Claim", { exact: true }).and(shown)).toHaveCount(1);
    // Who asked is a column from 1024px.
    if (!isMobile) {
      await expect(page.getByRole("cell", { name: "Arif Hidayat" })).toBeVisible();
    }
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);
  });

  test("search and the status are the address, and the queue counts what needs review", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Needs review" }).click();
    await expect(page).toHaveURL(/status=pending/);
    // A claim waits for a decision as a new organization does.
    await expect(shownOrganizations(page)).toHaveText(["Lumen Health", "Open Kitchen"]);
    await expect(page.getByText("2 need review")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search by name or email domain" }).fill("pocket");
    await expect(page).toHaveURL(/[?&]q=pocket/);
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText(
      "No organization matches",
    );

    // The way back is checked on a page read from its address: a click within moments of typing
    // races the toolbar's delayed write of the address, which puts the search back.
    await page.reload();
    await page.getByRole("link", { name: "Clear search and filter" }).click();
    await expect(page).toHaveURL("/admin/organizations");
    await expect(shownOrganizations(page)).toHaveCount(6);
  });

  test("an organization that waits is approved from its row", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    const dialog = await openReview(page);

    await expect(dialog.getByRole("heading")).toHaveText("Review Lumen Health");
    // Who created it and its website are read when the dialog opens.
    await expect(dialog.getByText(/created by Linh Nguyễn on Oct 1, 2026/)).toBeVisible();
    await expect(dialog.getByText("Company · Vietnam · lumenhealth.example")).toBeVisible();
    // The creator's work domain is proposed, for the operator to confirm.
    await expect(dialog.getByLabel("Email domain to verify (optional)")).toHaveValue(
      "lumenhealth.example",
    );
    expect(decisions).toEqual([]);
    await expectNoSeriousA11yViolations(page);

    await dialog.getByRole("button", { name: "Approve", exact: true }).click();

    await expect(page.getByText("Organization approved.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(decisions).toEqual([
      {
        call: `POST /api/organization/admin/organizations/${lumen}/approve`,
        body: { emailDomain: "lumenhealth.example" },
      },
    ]);
  });

  test("a domain that names none is not sent, and one another organization has is said at the field", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(
      page,
      decisionsPath,
      409,
      refusal("ORGANIZATION_DOMAIN_TAKEN"),
    );
    const dialog = await openReview(page);
    const domain = dialog.getByLabel("Email domain to verify (optional)");

    await domain.fill("not a domain");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(
      dialog.getByText("Enter a domain such as example.com, or leave it empty."),
    ).toBeVisible();
    expect(decisions).toEqual([]);

    await domain.fill("Taken.Example");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(
      dialog.getByText("Another organization already has this domain.", { exact: false }),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("a claim is decided from its row, with the domain the operator verified", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await answerClaimRecord(page);
    await page.goto("/admin/organizations");

    await page.getByRole("button", { name: "Actions for Open Kitchen" }).click();
    await page.getByRole("menuitem", { name: "Decide claim…" }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByRole("heading")).toHaveText("Decide the claim for Open Kitchen");
    await expect(dialog.getByText("I founded the team.")).toBeVisible();
    await expect(dialog.getByLabel("Email domain to verify (optional)")).toHaveValue(
      "openkitchen.example",
    );
    await expectNoSeriousA11yViolations(page);

    await dialog.getByLabel("Email domain to verify (optional)").fill("");
    await dialog.getByRole("button", { name: "Decline" }).click();

    await expect(page.getByText("Claim declined.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(decisions).toEqual([
      { call: `POST /api/organization/admin/claims/${claim}/decline`, body: null },
    ]);
  });

  test("a refusal is not sent without a reason, and carries the note to the owners", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    const dialog = await openReview(page);

    await dialog.getByRole("button", { name: "Do not approve…" }).click();
    await expect(dialog.getByRole("heading")).toHaveText("Do not approve Lumen Health");
    await expect(dialog.getByRole("button", { name: "Send decision" })).toBeDisabled();

    // Leaving the reason goes back to the review, where the organization can still be approved.
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog.getByRole("heading")).toHaveText("Review Lumen Health");
    await dialog.getByRole("button", { name: "Do not approve…" }).click();

    await giveReason(page, "Profile is incomplete", "  Say what you build.  ");
    await dialog.getByRole("button", { name: "Send decision" }).click();

    await expect(
      page.getByText("Organization not approved. Its owners can read the reason."),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(decisions).toEqual([
      {
        call: `POST /api/organization/admin/organizations/${lumen}/refuse`,
        body: { reason: "incomplete", message: "Say what you build." },
      },
    ]);
  });

  test("a decision the backend refuses is told in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerDecisions(page, decisionsPath, 409, refusal("ORGANIZATION_NOT_AWAITING_REVIEW"));
    const dialog = await openReview(page);

    await dialog.getByRole("button", { name: "Approve", exact: true }).click();

    await expect(page.getByText("This organization has already been reviewed.")).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    // The review stays open, so the operator can decide again or leave.
    await expect(dialog.getByRole("button", { name: "Approve", exact: true })).toBeEnabled();
  });

  test("a record shows what its people wrote, and a claim on it is decided there", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await answerClaimRecord(page);
    await page.goto("/admin/organizations");

    await page.getByRole("button", { name: "Actions for Open Kitchen" }).click();
    // An approved organization has no review; its claim is decided from the menu or on the record.
    await expect(page.getByRole("menuitem", { name: "Review…" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Open record" }).click();

    await expect(page).toHaveURL(`/admin/organizations/${openKitchen}`);
    await expect(page).toHaveTitle("Open Kitchen · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Open Kitchen");
    await expect(page.getByText("Đạt Phan on Oct 1, 2026")).toBeVisible();
    const claims = page.getByRole("region", { name: "Claims to own it" });
    await expect(claims.getByText("I founded the team.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await claims.getByRole("button", { name: "Decide claim…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Email domain to verify (optional)")).toHaveValue(
      "openkitchen.example",
    );
    await dialog.getByRole("button", { name: "Make owner" }).click();

    await expect(page.getByText("Claim approved. They now own the organization.")).toBeVisible();
    expect(decisions).toEqual([
      {
        call: `POST /api/organization/admin/claims/${claim}/approve`,
        body: { emailDomain: "openkitchen.example" },
      },
    ]);
  });

  test("a taken-down organization's record says why and restores it after asking", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/organizations/${quietMill}`);

    await expect(page.getByText("Taken down on Oct 6, 2026")).toBeVisible();
    await expect(page.getByText("Reason: Misleading or false information.")).toBeVisible();
    await expect(page.getByText("Send us the contract or remove the customer.")).toBeVisible();
    // Taking down is for an approved organization; this one is back only by a restore.
    await expect(page.getByRole("button", { name: "Actions for Quiet Mill" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();

    await expect(page.getByText("Quiet Mill is back. Its owners were told.")).toBeVisible();
    expect(decisions).toEqual([
      { call: `POST /api/organization/admin/organizations/${quietMill}/restore`, body: null },
    ]);
  });

  test("an approved organization is taken down with a reason its owners read", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/organizations/${pocketPolicy}`);

    await page.getByRole("button", { name: "Actions for Pocket Policy" }).click();
    await page.getByRole("menuitem", { name: "Take down…" }).click();
    const dialog = await giveReason(
      page,
      "Misleading or false information",
      "  The customer says it has not worked with you.  ",
    );
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Take down" }).click();

    await expect(
      page.getByText("Pocket Policy was taken down. Its owners were told."),
    ).toBeVisible();
    expect(decisions).toEqual([
      {
        call: `POST /api/organization/admin/organizations/${pocketPolicy}/take-down`,
        body: {
          reason: "misleading_information",
          message: "The customer says it has not worked with you.",
        },
      },
    ]);
  });

  test("an operator saves the profile with the verified domain", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 200, {});
    await page.goto(`/admin/organizations/${pocketPolicy}`);

    await page.getByLabel("Short description").fill("Claim assistants for insurers.");
    await page.getByLabel("Year founded").fill("2021");
    await page.getByLabel("Verified domain").fill("pocketpolicy.example");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0].call).toBe(`PUT /api/organization/admin/organizations/${pocketPolicy}`);
    expect(decisions[0].body).toMatchObject({
      profile: {
        name: "Pocket Policy",
        description: "Claim assistants for insurers.",
        foundedYear: 2021,
        version: 0,
      },
      emailDomain: "pocketpolicy.example",
    });
  });

  test("the members are paged ten at a time, with the open invitations on the last page", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/organizations/${harborBank}?tab=members`);

    await expect(shownOrganizations(page)).toHaveCount(10);
    await expect(page.getByText("12 members · 1 invitation open")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("link", { name: "Go to the next page" }).first().click();
    await expect(page).toHaveURL(/page=2/);
    await expect(shownOrganizations(page)).toHaveText([
      "Teller 11",
      "Teller 12",
      "newhire@harborbank.example",
    ]);
  });

  test("an operator changes a role, removes a person, invites and withdraws an invitation", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    const record = `/api/organization/admin/organizations/${harborBank}`;
    await page.goto(`/admin/organizations/${harborBank}?tab=members`);
    // Each person is in the page twice, as a table row and as a stacked one; the viewport shows one.
    const actions = (name: string) =>
      page.getByRole("button", { name: `Actions for ${name}` }).and(page.locator(":visible"));

    await actions("Teller 02").click();
    await page.getByRole("menuitem", { name: "Make owner" }).click();
    await expect(page.getByText("Teller 02 is now an owner.")).toBeVisible();

    // The only owner is made a member only after being told the organization will have none.
    await actions("Teller 01").click();
    await page.getByRole("menuitem", { name: "Make member" }).click();
    const demote = page.getByRole("alertdialog", { name: "Make the only owner a member?" });
    await expect(demote.getByText("The organization will have no owner.")).toBeVisible();
    await demote.getByRole("button", { name: "Make member" }).click();
    await expect(page.getByText("Teller 01 is now a member.")).toBeVisible();

    await actions("Teller 03").click();
    await page.getByRole("menuitem", { name: "Remove from organization" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove member" }).click();
    await expect(page.getByText("Teller 03 was removed.")).toBeVisible();

    await page.getByRole("button", { name: "Invite a person" }).click();
    const invite = page.getByRole("dialog");
    await invite.getByLabel("Email address").fill("  cto@harborbank.example ");
    await invite.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Invitation sent.")).toBeVisible();

    await page.goto(`/admin/organizations/${harborBank}?tab=members&page=2`);
    await page
      .getByRole("button", { name: "Withdraw the invitation to newhire@harborbank.example" })
      .and(page.locator(":visible"))
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Withdraw invitation" })
      .click();
    await expect(page.getByText("Invitation withdrawn.")).toBeVisible();

    expect(decisions).toEqual([
      { call: `PUT ${record}/members/${secondTeller}/role`, body: { role: "owner" } },
      { call: `PUT ${record}/members/${firstTeller}/role`, body: { role: "member" } },
      { call: `POST ${record}/members/${thirdTeller}/remove`, body: null },
      {
        call: `POST ${record}/invitations`,
        body: { email: "cto@harborbank.example", role: "owner" },
      },
      { call: `POST ${record}/invitations/${invitation}/revoke`, body: null },
    ]);
  });

  test("a refused organization's record says why, and offers no review", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/organizations/${firstcall}`);

    await expect(page.getByText("Not approved: Profile is incomplete.")).toBeVisible();
    await expect(page.getByText("Say what the company builds.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review…" })).toHaveCount(0);

    expect((await page.goto("/admin/organizations/no-such-record"))?.status()).toBe(404);
  });

  test("an operator adds an organization, which needs a name and a type", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto("/admin/organizations");

    await page.getByRole("button", { name: "Add organization" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Add an organization");
    await expectNoSeriousA11yViolations(page);

    await dialog.getByRole("button", { name: "Add organization" }).click();
    await expect(dialog.getByText("Enter the organization's name.")).toBeVisible();
    await expect(dialog.getByText("Choose the type of organization.")).toBeVisible();
    expect(decisions).toEqual([]);

    await dialog.getByLabel("Organization name").fill("Sài Gòn Logistics");
    await dialog.getByRole("combobox", { name: "Organization type" }).click();
    await page.getByRole("option", { name: "Builder team" }).click();
    await dialog.getByRole("button", { name: "Add organization" }).click();

    await expect(page.getByText("Sài Gòn Logistics created.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(decisions).toEqual([
      {
        call: "POST /api/organization/admin/organizations",
        body: {
          name: "Sài Gòn Logistics",
          type: "builder_team",
          website: null,
          country: null,
          teamSize: null,
          industries: null,
          description: null,
          foundedYear: null,
          logoUrl: null,
          emailDomain: null,
          ownerEmail: null,
        },
      },
    ]);
  });

  test("an operator may describe the whole organization while adding it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto("/admin/organizations");

    await page.getByRole("button", { name: "Add organization" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Organization name").fill("Sài Gòn Logistics");
    await dialog.getByRole("combobox", { name: "Organization type" }).click();
    await page.getByRole("option", { name: "Company" }).click();
    await dialog.getByLabel("Website").fill("https://saigonlogistics.example");
    await dialog.getByLabel("Owner's email").fill("owner@saigonlogistics.example");
    await dialog.getByLabel("Email domain").fill("@SaigonLogistics.example");
    await dialog.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Vietnam" }).click();
    await dialog.getByRole("combobox", { name: "Team size" }).click();
    await page.getByRole("option", { name: "10–49 people" }).click();
    await dialog.getByLabel("Year founded").fill("20x9");
    await dialog.getByRole("button", { name: "Add organization" }).click();
    await expect(dialog.getByText("Enter a four-digit year, such as 2021.")).toBeVisible();
    expect(decisions).toEqual([]);

    await dialog.getByLabel("Year founded").fill("2019");
    await dialog.getByLabel("Short description").fill("Routes parcels for small shops.");
    await dialog.getByRole("button", { name: "Add organization" }).click();

    await expect(page.getByText("Sài Gòn Logistics created.")).toBeVisible();
    expect(decisions).toEqual([
      {
        call: "POST /api/organization/admin/organizations",
        body: {
          name: "Sài Gòn Logistics",
          type: "company",
          website: "https://saigonlogistics.example",
          country: "VN",
          teamSize: "10_49",
          industries: null,
          description: "Routes parcels for small shops.",
          foundedYear: 2019,
          logoUrl: null,
          emailDomain: "saigonlogistics.example",
          ownerEmail: "owner@saigonlogistics.example",
        },
      },
    ]);
  });
});
