import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, giveReason, refusal } from "./reviews";
import { signInAs } from "./session";

const lumen = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c01";
const openKitchen = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c02";
const pocketPolicy = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03";
const quietMill = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c06";
const harborBank = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c07";
const pocketPolicyLtd = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c08";
const firstTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a30";
const secondTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a31";
const thirdTeller = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a32";
const invitation = "7d5a7e96-4d42-4e97-9e99-4b7dad0f1e01";
const claim = "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d01";

const decisionsPath = "**/api/organization/admin/**";

/** The organizations shown, by the name each row leads with. */
/** The organizations the list shows, by the link to each one's record. */
function shownOrganizations(page: Page) {
  return page.locator('a[href*="/admin/organizations/"]:visible');
}

/** The people of an organization's members tab, by their names. */
function shownPeople(page: Page) {
  return page.locator('[data-slot="person"]:visible >> span.font-medium');
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

  test("an operator sees every organization, those with a claim first, and what each asks", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organizations");
    await expect(shownOrganizations(page)).toHaveText([
      "Open Kitchen",
      "Firstcall",
      "Lumen Health",
      "Pocket Policy",
      "Quiet Mill",
      "Harbor Bank",
    ]);
    await expect(page.getByText("6 organizations")).toBeVisible();
    const shown = page.locator(":visible");
    await expect(page.getByText("Company · Singapore · 2 members").and(shown)).toHaveCount(1);
    await expect(page.getByText("Builder team · Vietnam · No owner").and(shown)).toHaveCount(1);
    await expect(page.getByText("New organization").and(shown)).toHaveCount(0);
    // The claim is read from the status; the list has no request or asked-by column.
    for (const name of ["Request", "Asked by", "Received"]) {
      await expect(page.getByRole("columnheader", { name })).toHaveCount(0);
    }
    // A table at every width: on a phone it scrolls sideways.
    await expect(page.getByRole("table")).toHaveCount(1);
    await expectNoSeriousA11yViolations(page);
  });

  test("a row offers its claim and its record, and no review", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    await page.getByRole("button", { name: "Actions for Open Kitchen" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Decide claim", "Open record"]);
    for (const name of ["Approve", "Send back", "Refuse", "Review"]) {
      await expect(page.getByRole("menuitem", { name })).toHaveCount(0);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Review / })).toHaveCount(0);

    // A row without a claim offers its record only.
    await page.getByRole("button", { name: "Actions for Lumen Health" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Open record"]);
  });

  test("search and the status are the address, and the queue counts the open claims", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Claim open" }).click();
    await expect(page).toHaveURL(/status=claimed/);
    await expect(shownOrganizations(page)).toHaveText(["Open Kitchen", "Firstcall"]);
    await expect(page.getByText("2 claims are open")).toBeVisible();

    // A bookmark of the retired review queue shows every organization, not an error.
    await page.goto("/admin/organizations?status=in_review");
    await expect(shownOrganizations(page)).toHaveCount(6);
    await expect(page.getByRole("combobox", { name: "Status" })).toContainText("All statuses");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Claim open" }).click();

    await page.getByRole("searchbox", { name: "Search by name or email domain" }).fill("pocket");
    await expect(page).toHaveURL(/[?&]q=pocket/);
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText(
      "No organization matches",
    );

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL("/admin/organizations");
    await expect(shownOrganizations(page)).toHaveCount(6);
  });

  test("the download holds the list as the address narrows it, in the format chosen", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const asked: string[] = [];
    await page.route("**/api/organization/admin/organizations/export**", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      asked.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: { "Content-Disposition": `attachment; filename="organizations-2026-10-14.xlsx"` },
        body: "PK",
      });
    });
    await page.goto("/admin/organizations?status=claimed&q=open");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("menuitem", { name: "Excel (.xlsx)" }).click();
    expect((await download).suggestedFilename()).toBe("organizations-2026-10-14.xlsx");
    expect(asked).toHaveLength(1);
    const query = new URL(asked[0]).searchParams;
    expect(query.get("format")).toBe("xlsx");
    expect(query.get("status")).toBe("claimed");
    expect(query.get("q")).toBe("open");
    // Every page of the list goes into the file, so the page it shows is not sent.
    expect(query.has("page")).toBe(false);
  });

  test("the country and the page size are the address, and a new size starts the list again", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/organizations");

    // Only the countries organizations are in are offered.
    await page.getByRole("combobox", { name: "Country" }).click();
    await expect(page.getByRole("option")).toHaveText(["All countries", "Singapore", "Vietnam"]);
    await page.getByRole("option", { name: "Singapore" }).click();
    await expect(page).toHaveURL(/country=SG/);
    await expect(shownOrganizations(page)).toHaveCount(1);

    await page.goto("/admin/organizations?size=2&page=2");
    await expect(shownOrganizations(page)).toHaveCount(2);
    await page.getByRole("combobox", { name: "Per page" }).click();
    await page.getByRole("option", { name: "10", exact: true }).click();
    await expect(page).toHaveURL(/[?&]size=10/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(shownOrganizations(page)).toHaveCount(6);

    // The size stays changeable after it fits the whole result, and another filter does not hide it.
    await page.getByRole("combobox", { name: "Per page" }).click();
    await page.getByRole("option", { name: "25", exact: true }).click();
    await expect(page).toHaveURL(/[?&]size=25/);
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Singapore" }).click();
    await expect(shownOrganizations(page)).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Per page" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]size=25/);
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
    await answerClaimRecord(page);
    await page.goto("/admin/organizations");
    await page.getByRole("button", { name: "Actions for Open Kitchen" }).click();
    await page.getByRole("menuitem", { name: "Decide claim" }).click();
    const dialog = page.getByRole("dialog");
    const domain = dialog.getByLabel("Email domain to verify (optional)");

    await domain.fill("not a domain");
    await dialog.getByRole("button", { name: "Make owner" }).click();
    await expect(
      dialog.getByText("Enter a domain such as example.com, or leave it empty."),
    ).toBeVisible();
    expect(decisions).toEqual([]);

    await domain.fill("Taken.Example");
    await dialog.getByRole("button", { name: "Make owner" }).click();
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
    await page.getByRole("menuitem", { name: "Decide claim" }).click();
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
    // Its claim is decided from the menu or on the record.
    await page.getByRole("menuitem", { name: "Open record" }).click();

    await expect(page).toHaveURL(`/admin/organizations/${openKitchen}`);
    await expect(page).toHaveTitle("Open Kitchen · BeyondPilot");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Open Kitchen");
    await expect(page.getByText("Created by Đạt Phan on 1 Oct 2026")).toBeVisible();
    // No review panel stands on a record: nothing waits for one.
    for (const name of ["Review", "Approve", "Send back", "Refuse"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    const claims = page.getByRole("region", { name: "Claims to own it" });
    await expect(claims.getByText("I founded the team.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await claims.getByRole("button", { name: "Decide claim" }).click();
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

    await expect(page.getByText("Taken down on 6 Oct 2026")).toBeVisible();
    await expect(page.getByText("Reason: Misleading or false information.")).toBeVisible();
    await expect(page.getByText("Send us the contract or remove the customer.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    // Taking down is for an active organization; this one is back only by a restore.
    await page.getByRole("button", { name: "Actions for Quiet Mill" }).click();
    await expect(page.getByRole("menuitem", { name: "Merge into another…" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Take down" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();

    await expect(page.getByText("Quiet Mill is back. Its owners were told.")).toBeVisible();
    expect(decisions).toEqual([
      { call: `POST /api/organization/admin/organizations/${quietMill}/restore`, body: null },
    ]);
  });

  test("an active organization is taken down with a reason its owners read", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    await page.goto(`/admin/organizations/${pocketPolicy}`);

    await page.getByRole("button", { name: "Actions for Pocket Policy" }).click();
    await page.getByRole("menuitem", { name: "Take down" }).click();
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

  test("a duplicate is merged into the organization kept, once that is confirmed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 204);
    // The browser asks for the organizations to keep as the name is typed; the duplicate is among them.
    const searches: string[] = [];
    await page.route(
      (url) => url.pathname === "/api/organization/admin/organizations",
      (route) => {
        searches.push(new URL(route.request().url()).search);
        return route.fulfill({
          json: {
            items: [
              { id: harborBank, name: "Harbor Bank" },
              { id: pocketPolicy, name: "Pocket Policy" },
            ],
            page: 1,
            pageSize: 25,
            total: 2,
          },
        });
      },
    );
    await page.goto(`/admin/organizations/${harborBank}`);

    await page.getByRole("button", { name: "Actions for Harbor Bank" }).click();
    await page.getByRole("menuitem", { name: "Merge into another…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Merge Harbor Bank" })).toBeVisible();
    await expect(
      dialog.getByText(
        "12 members and 1 open invitation move with it, and so do its solutions and use cases.",
      ),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();
    await dialog.getByRole("combobox", { name: "Keep" }).fill("Pocket");
    // Only an active organization is asked for, and the duplicate itself is never offered.
    await expect(page.getByRole("option")).toHaveText(["Pocket Policy"]);
    await expect.poll(() => searches).toContain("?q=Pocket&status=active");
    await page.getByRole("option", { name: "Pocket Policy" }).click();
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Continue" }).click();

    // The merge is asked once, naming both organizations and what it does; nothing is typed.
    const confirmation = page.getByRole("alertdialog");
    await expect(
      confirmation.getByRole("heading", { name: "Merge Harbor Bank into Pocket Policy?" }),
    ).toBeVisible();
    await expect(
      confirmation.getByText(
        "12 members and 1 open invitation move with it, and so do its solutions and use cases.",
      ),
    ).toBeVisible();
    await expect(
      confirmation.getByText(
        "Harbor Bank stays only as a record of where it went, and its members are told by email. This cannot be undone.",
      ),
    ).toBeVisible();
    await expect(confirmation.getByRole("textbox")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await confirmation.getByRole("button", { name: "Merge" }).click();

    await expect(
      page.getByText("Harbor Bank was merged into Pocket Policy. Its members were told."),
    ).toBeVisible();
    expect(decisions).toEqual([
      {
        call: `POST /api/organization/admin/organizations/${harborBank}/merge`,
        body: { intoId: pocketPolicy },
      },
    ]);
  });

  test("a merged organization only says where it went, and is listed only under merged", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/organizations/${pocketPolicyLtd}`);

    await expect(
      page.getByRole("heading", { name: "Merged into Pocket Policy on 7 Oct 2026 by Young Xv" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "beyondpilot.ai/organizations/pocket-policy-ltd now leads to the page of Pocket Policy.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Pocket Policy" })).toHaveAttribute(
      "href",
      `/admin/organizations/${pocketPolicy}`,
    );
    // Nothing on it can be changed any more.
    await expect(page.getByRole("button", { name: "Actions for Pocket Policy Ltd" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // Its people went to the organization kept, so nobody is asked to invite a first owner.
    await page.goto(`/admin/organizations/${pocketPolicyLtd}?tab=members`);
    await expect(page.getByText("No members", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Invite its first owner.")).toHaveCount(0);

    await page.goto("/admin/organizations?q=pocket");
    await expect(shownOrganizations(page)).toHaveText(["Pocket Policy"]);
    await page.goto("/admin/organizations?status=merged");
    await expect(shownOrganizations(page)).toHaveText(["Pocket Policy Ltd"]);
    await expect(
      page.getByText("Merged into Pocket Policy", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible();
  });

  test("an operator saves the profile with the verified domain", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const decisions = await answerDecisions(page, decisionsPath, 200, {});
    await page.goto(`/admin/organizations/${pocketPolicy}`);

    // The profile reads until the operator chooses to edit it.
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit profile" }).click();
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

    await expect(shownPeople(page)).toHaveCount(10);
    await expect(page.getByText("12 members · 1 invitation open")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("link", { name: "Go to the next page" }).first().click();
    await expect(page).toHaveURL(/page=2/);
    await expect(shownPeople(page)).toHaveText([
      "Teller 11",
      "Teller 12",
      "newhire@harborbank.example",
    ]);
    await expect(
      page.getByText("Invited 1 Oct 2026 · expires 8 Oct 2026").filter({ visible: true }),
    ).toHaveCount(1);
  });

  test("an organization nobody joined says so once, and asks for its first owner", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`/admin/organizations/${openKitchen}?tab=members`);

    await expect(page.getByText("Invite its first owner.")).toBeVisible();
    await expect(page.getByText("No members", { exact: true })).toHaveCount(1);
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
    const actions = (name: string) =>
      page.getByRole("button", { name: `Actions for ${name}` }).and(page.locator(":visible"));

    await actions("Teller 02").click();
    await page.getByRole("menuitem", { name: "Make owner" }).click();
    await expect(page.getByText("Teller 02 is now an owner.")).toBeVisible();

    // The only owner is made a member only after being told what nobody can do without one.
    await actions("Teller 01").click();
    await page.getByRole("menuitem", { name: "Make member" }).click();
    const demote = page.getByRole("alertdialog", { name: "Make the only owner a member?" });
    await expect(
      demote.getByText("Nobody can invite people or change its profile until you invite an owner."),
    ).toBeVisible();
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
          logoFileId: null,
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
    await expect(
      dialog.getByText("Enter a four-digit year no later than this year, such as 2021."),
    ).toBeVisible();
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
          logoFileId: null,
          emailDomain: "saigonlogistics.example",
          ownerEmail: "owner@saigonlogistics.example",
        },
      },
    ]);
  });
});
