import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const pocketPolicy = "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03";
const minh = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04";
const siti = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a12";
const invitation = "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d11";
const request = "9c4f6d85-3c31-4d86-8d88-3a6c9c9e0d12";

const changesPath = "**/api/organization/**";

/** Answers the search of the ways into an organization, which the browser asks as a person types. */
async function answerSearch(page: Page, items: object[]) {
  await page.route("**/api/organization/organizations?q=*", (route) =>
    route.fulfill({ json: { items } }),
  );
}

/** The people shown, by the name each row leads with, whichever layout the viewport has. */
/** The people of the members list, not those asking to join above it. */
function shownPeople(page: Page) {
  return page
    .getByRole("region", { name: "Members", exact: true })
    .locator('[data-slot="person"]:visible >> span.font-medium');
}

test.describe("workspace organization", () => {
  test.use({ locale: "en-US" });

  for (const path of [
    "/workspace/organization",
    "/workspace/organization/new",
    "/workspace/organization/members",
    "/workspace/organization/solutions",
  ]) {
    test(`a visitor to ${path} is sent to sign in and back`, async ({ page }) => {
      const answer = await page.request.get(path, { maxRedirects: 0 });
      expect(answer.status()).toBe(307);
      expect(answer.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(path)}`);
    });
  }

  test("a person without an organization finds one by name and asks to join it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await answerSearch(page, [
      {
        id: pocketPolicy,
        name: "Pocket Policy",
        type: "company",
        country: "SG",
        emailDomain: "pocketpolicy.example",
        way: "request",
      },
    ]);
    const changes = await answerDecisions(page, changesPath, 200, { outcome: "requested" });
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your organization");
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("searchbox", { name: "Company or team name" }).fill("pocket");
    await expect(page.getByText("Company · Singapore")).toBeVisible();
    await expect(page.getByText("Managed by its owners")).toBeVisible();
    await expect(
      page.getByText(
        "Your email is not on pocketpolicy.example, so an owner of Pocket Policy decides.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Request to join" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Ask to join Pocket Policy?");
    await dialog.getByLabel("Message (optional)").fill("  I work with Minh.  ");
    await dialog.getByRole("button", { name: "Request to join" }).click();

    await expect(page.getByText("Request sent to Pocket Policy.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(changes).toEqual([
      {
        call: `POST /api/organization/organizations/${pocketPolicy}/join`,
        body: { message: "I work with Minh." },
      },
    ]);
  });

  test("a name nobody has leads to creating the organization", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await answerSearch(page, []);
    await page.goto("/workspace/organization");

    await page.getByRole("searchbox", { name: "Company or team name" }).fill("Sài Gòn Logistics");
    await expect(
      page.getByText(
        "No organization matches “Sài Gòn Logistics”. Check the spelling, or create it.",
      ),
    ).toBeVisible();
    await page.getByRole("link", { name: "Create a new organization" }).click();

    await expect(page).toHaveURL("/workspace/organization/new");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your organization");
  });

  test("a new organization needs its facts, and goes to review", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const changes = await answerDecisions(page, changesPath, 201, {});
    await page.goto("/workspace/organization/new");

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Enter the organization's name.")).toBeVisible();
    await expect(page.getByText("Select a team size.")).toBeVisible();
    await expect(page.getByText("Choose at least one industry.")).toBeVisible();
    await expect(page.getByText("Select a country.")).toBeVisible();
    // The website, the year and the description are asked as the mockup asks them.
    await expect(page.getByText("Enter a full address that starts with https://")).toBeVisible();
    await expect(page.getByText("Enter a four-digit year, such as 2021.")).toBeVisible();
    await expect(page.getByText("Describe the organization in a few words.")).toBeVisible();
    // The first field that lacks something is where the person continues.
    await expect(page.getByLabel("Organization name")).toBeFocused();
    expect(changes).toEqual([]);
    // The pointer still rests on the button; its hover colour is not what is checked here.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel("Organization name").fill("Sài Gòn Logistics");
    await page.getByLabel("Website").fill("https://saigonlogistics.example");
    await page.getByRole("combobox", { name: "Team size" }).click();
    await page.getByRole("option", { name: "2–9 people" }).click();
    await page.getByRole("combobox", { name: "Industries" }).fill("Logis");
    await page.getByRole("option", { name: "Logistics" }).click();
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Vietnam" }).click();
    await page.getByLabel("Year founded").fill("2019");
    await page.getByLabel("Short description").fill("Route planning for fleets.");
    await page.getByRole("button", { name: "Submit for approval" }).click();

    await expect(page.getByText("Organization created and sent for review.")).toBeVisible();
    await expect(page).toHaveURL("/workspace/organization");
    expect(changes).toEqual([
      {
        call: "POST /api/organization/organizations",
        body: {
          name: "Sài Gòn Logistics",
          type: "company",
          country: "VN",
          teamSize: "2_9",
          industries: ["logistics"],
          website: "https://saigonlogistics.example",
          description: "Route planning for fleets.",
          foundedYear: 2019,
          logoFileId: null,
        },
      },
    ]);
  });

  test("an invited person accepts with their job title", async ({ page, context, baseURL }) => {
    await signInAs(context, "invited", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Join Pocket Policy on BeyondPilot",
    );
    await expect(page.getByText("Invited by Minh Trần on Oct 1, 2026")).toBeVisible();
    await expect(
      page.getByText("Minh Trần invited hoa.le@example.com to join as a member."),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel("Your job title").fill("Claims analyst");
    await page.getByRole("button", { name: "Accept and join" }).click();

    await expect(page.getByText("You joined the organization.")).toBeVisible();
    expect(changes).toEqual([
      { call: `POST /api/organization/invitations/${invitation}/accept`, body: null },
      { call: "PUT /api/organization/mine/job-title", body: { jobTitle: "Claims analyst" } },
    ]);
  });

  test("a person who asked to join waits, and can withdraw the request", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "asked", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your request to join Pocket Policy is with its owners",
    );
    await expect(page.getByText("Company · Singapore · asked on Oct 1, 2026")).toBeVisible();
    // Whoever asked to join one organization does not create another.
    await page.goto("/workspace/organization/new");
    await expect(page).toHaveURL("/workspace/organization");

    await page.getByRole("button", { name: "Withdraw the request" }).click();

    await expect(page.getByText("Request withdrawn.")).toBeVisible();
    expect(changes).toEqual([{ call: "POST /api/organization/join-request/withdraw", body: null }]);
  });

  test("a person whose request was declined reads it, asks again or looks elsewhere", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "declined", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, { outcome: "requested" });
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your request to join Pocket Policy was declined",
    );
    await expect(page.getByText("Company · Singapore · declined on Oct 1, 2026")).toBeVisible();
    await expect(
      page.getByText("An owner of Pocket Policy declined the request.", { exact: false }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Ask again" }).click();
    await expect(page.getByText("Request sent.")).toBeVisible();
    expect(changes).toEqual([
      {
        call: `POST /api/organization/organizations/${pocketPolicy}/join`,
        body: { message: null },
      },
    ]);

    // Looking elsewhere is the same page on its finder.
    await page.getByRole("link", { name: "Find another organization" }).click();
    await expect(page).toHaveURL("/workspace/organization?find=1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find your organization");
  });

  test("an owner saves the profile only after a change, and can take the change back", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pocket Policy");
    await expect(page.getByText("Company · Singapore · pocketpolicy.example")).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Sections of your organization" });
    await expect(tabs.getByRole("link")).toHaveText([
      "Profile",
      "Members2",
      "Solutions4",
      "Introductions",
      "Use cases0",
    ]);
    await expect(tabs.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The profile reads until the owner chooses to edit it.
    await expect(page.getByText("Assistants for insurers across Southeast Asia.")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await page.getByRole("button", { name: "Edit profile" }).click();

    const save = page.getByRole("button", { name: "Save changes" });
    await expect(save).toBeDisabled();
    await expect(page.getByLabel("Verified email domain")).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    // Unsaved changes are dropped by leaving the page, where the leave guard asks; there is no discard.
    await expect(page.getByRole("button", { name: "Discard changes" })).toHaveCount(0);

    const description = page.getByLabel("Short description");
    await description.fill("Assistants for insurers and brokers.");
    await expect(save).toBeEnabled();
    await page.getByRole("combobox", { name: "Industries" }).fill("Health");
    await page.getByRole("option", { name: "Healthcare" }).click();
    await save.click();

    await expect(page.getByText("Profile saved.")).toBeVisible();
    expect(changes).toEqual([
      {
        call: "PUT /api/organization/mine",
        body: {
          name: "Pocket Policy",
          type: "company",
          country: "SG",
          teamSize: "10_49",
          industries: ["insurance", "healthcare"],
          website: "https://pocketpolicy.example",
          description: "Assistants for insurers and brokers.",
          foundedYear: 2021,
          logoFileId: null,
          // The version the form loaded, so a save over someone else's change is refused.
          version: 3,
        },
      },
    ]);
  });

  test("leaving a changed profile asks first, and a stale save is told by its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await answerDecisions(page, changesPath, 409, refusal("ORGANIZATION_CHANGED_MEANWHILE"));
    await page.goto("/workspace/organization");
    await page.getByRole("button", { name: "Edit profile" }).click();

    // Once the page answers a change: text typed before that is not the form's yet.
    const description = page.getByLabel("Short description");
    await expect(async () => {
      await description.fill("Unsaved words.");
      await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled({
        timeout: 1000,
      });
      await expect(description).toHaveValue("Unsaved words.", { timeout: 1000 });
    }).toPass();
    await page
      .getByRole("navigation", { name: "Sections of your organization" })
      .getByRole("link", { name: "Members" })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText("Leave without saving?");
    await confirm.getByRole("button", { name: "Stay" }).click();
    await expect(page).toHaveURL("/workspace/organization");
    await expect(description).toHaveValue("Unsaved words.");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Someone else changed this profile. Reload the page and try again."),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });

  test("a member reads the profile and cannot change it", async ({ page, context, baseURL }) => {
    await signInAs(context, "member", baseURL!);
    await page.goto("/workspace/organization");

    await expect(page.getByRole("heading", { name: "Organization profile" })).toBeVisible();
    await expect(page.getByText("Assistants for insurers across Southeast Asia.")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("the members are paged, and the open invitations close the last page", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "crowd", baseURL!);
    await page.goto("/workspace/organization/members");

    await expect(shownPeople(page)).toHaveCount(10);
    await expect(page.getByText("12 members · 1 invitation pending")).toBeVisible();
    await expect(page.getByText("hoa.le@example.com")).toHaveCount(0);
    const pages = page.getByRole("navigation", { name: "Pages" });
    await expect(pages.getByRole("link", { name: "Go to the previous page" })).toHaveCount(0);

    await pages.getByRole("link", { name: "Go to the next page" }).click();
    await expect(page).toHaveURL("/workspace/organization/members?page=2");
    await expect(shownPeople(page)).toHaveText(["Member 11", "Member 12", "hoa.le@example.com"]);
    await expect(pages.getByRole("link", { name: "Go to the next page" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await pages.getByRole("link", { name: "Go to the previous page" }).click();
    await expect(page).toHaveURL("/workspace/organization/members");
  });

  test("an owner sees members, requests and invitations, and decides a request", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization/members");

    await expect(shownPeople(page)).toHaveText(["Minh Trần", "Siti Rahma", "hoa.le@example.com"]);
    await expect(
      page.getByText("2 members · 1 invitation pending · 19 of 20 invitations left today"),
    ).toBeVisible();
    // The row is drawn as a table row and as a stacked row; one of them shows.
    await expect(
      page.getByText("Invited Oct 1, 2026 · expires Oct 8, 2026").filter({ visible: true }),
    ).toHaveCount(1);
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expect(page.getByText("On pocketpolicy.example")).toBeVisible();
    await expect(page.getByText("I joined the claims team.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Request approved. They are now a member.")).toBeVisible();
    await page.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Request declined.")).toBeVisible();

    expect(changes).toEqual([
      { call: `POST /api/organization/mine/requests/${request}/approve`, body: null },
      { call: `POST /api/organization/mine/requests/${request}/decline`, body: null },
    ]);
  });

  test("an owner invites several people at once, each by their address", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization/members");

    await page.getByRole("button", { name: "Invite people" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Invite people to Pocket Policy");
    await expect(
      dialog.getByText("19 of 20 invitations left today; 49 of 50 can be open at once.", {
        exact: false,
      }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Send invitations" }).click();
    await expect(
      dialog.getByText("Enter full email addresses, separated by commas."),
    ).toBeVisible();
    expect(changes).toEqual([]);
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await dialog.getByLabel("Email addresses").fill("an@pocketpolicy.example, binh@example.com");
    await dialog.getByLabel("Role").selectOption({ label: "Owner" });
    await dialog.getByRole("button", { name: "Send invitations" }).click();

    await expect(page.getByText("2 invitations sent.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(changes).toEqual([
      {
        call: "POST /api/organization/mine/invitations",
        body: { email: "an@pocketpolicy.example", role: "owner" },
      },
      {
        call: "POST /api/organization/mine/invitations",
        body: { email: "binh@example.com", role: "owner" },
      },
    ]);
  });

  test("an owner who reached the day's limit is told, and the rest of the addresses wait", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(
      page,
      changesPath,
      429,
      refusal("ORGANIZATION_INVITATION_DAILY_LIMIT"),
    );
    await page.goto("/workspace/organization/members");

    await page.getByRole("button", { name: "Invite people" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email addresses").fill("an@example.com, binh@example.com");
    await dialog.getByRole("button", { name: "Send invitations" }).click();

    await expect(
      page.getByText("The organization has sent the most invitations it can in a day.", {
        exact: false,
      }),
    ).toBeVisible();
    // The second address is not tried once the limit is said, and both stay to send tomorrow.
    expect(changes).toHaveLength(1);
    await expect(dialog.getByLabel("Email addresses")).toHaveValue(
      "an@example.com, binh@example.com",
    );
  });

  test("an owner changes a role, removes a member, withdraws an invitation and opens the domain", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization/members");

    await page.getByRole("button", { name: "Actions for Siti Rahma" }).click();
    await page.getByRole("menuitem", { name: "Make owner" }).click();
    await expect(page.getByText("Siti Rahma is now an owner.")).toBeVisible();

    await page.getByRole("button", { name: "Actions for Siti Rahma" }).click();
    await page.getByRole("menuitem", { name: "Remove from organization" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText("Remove this member?");
    await expect(confirm.getByText("siti@pocketpolicy.example")).toBeVisible();
    await confirm.getByRole("button", { name: "Remove member" }).click();
    await expect(page.getByText("Siti Rahma was removed.")).toBeVisible();

    await page
      .getByRole("button", { name: "Actions for the invitation to hoa.le@example.com" })
      .click();
    await page.getByRole("menuitem", { name: "Withdraw invitation" }).click();
    await expect(page.getByText("Invitation withdrawn.")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "People with an @pocketpolicy.example email ask to join" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(
      page.getByText("Colleagues on your verified domain now join without asking."),
    ).toBeVisible();

    expect(changes).toEqual([
      { call: `PUT /api/organization/mine/members/${siti}/role`, body: { role: "owner" } },
      { call: `POST /api/organization/mine/members/${siti}/remove`, body: null },
      { call: `POST /api/organization/mine/invitations/${invitation}/revoke`, body: null },
      { call: "PUT /api/organization/mine/auto-join", body: { autoJoin: true } },
    ]);
  });

  test("the last owner cannot leave, in the words of the refusal's code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(
      page,
      changesPath,
      409,
      refusal("ORGANIZATION_LAST_OWNER"),
    );
    await page.goto("/workspace/organization/members");

    await page.getByRole("button", { name: "Actions for Minh Trần" }).click();
    await page.getByRole("menuitem", { name: "Leave organization" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave organization" }).click();

    await expect(
      page.getByText("An organization needs an owner. Make someone else an owner first."),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    expect(changes.map((change) => change.call)).toEqual([
      `POST /api/organization/mine/members/${minh}/remove`,
    ]);
  });

  test("a member manages nobody but themselves: their job title, and leaving", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "member", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await page.goto("/workspace/organization/members");

    await expect(page.getByRole("button", { name: "Invite people" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Actions for Minh Trần" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Turn on" })).toHaveCount(0);

    await page.getByRole("button", { name: "Actions for Siti Rahma" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit job title", "Leave organization"]);
    await page.getByRole("menuitem", { name: "Edit job title" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Job title").fill("Claims lead");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Job title saved.")).toBeVisible();
    expect(changes).toEqual([
      { call: "PUT /api/organization/mine/job-title", body: { jobTitle: "Claims lead" } },
    ]);
  });
});
