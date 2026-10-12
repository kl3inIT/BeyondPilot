import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { answerUploads } from "./stored-files";
import {
  minh,
  policyChat,
  proposalDeck,
  proposalForm,
  proposalId,
  proposalUseCaseId,
  siti,
} from "./stub-wizards.mjs";
import { answerWorkspace } from "./stub-workspace.mjs";

const proposePath = `/use-cases/${proposalUseCaseId}/propose`;
const storedApproach = "Policy Chat answers a policyholder's question from the policy itself.";

type Saved = {
  solutionIds: string[];
  approach: string;
  deckFileId: string | null;
  team: { accountId: string; role: string; primary: boolean }[];
  version: number | null;
};

/**
 * Answers what the browser writes while a proposal is written, as the backend would. `scene` is
 * the state the stub backend answers the page with (stub-wizards.mjs); sending moves it to `sent`,
 * so the page that follows reads a sent proposal. Returns what it saw.
 */
async function fakeBackend(page: Page, baseURL: string, scene?: "draft" | "sent") {
  const saves: Saved[] = [];
  const contacts: unknown[] = [];
  const sends: string[] = [];
  const stand = (next: string) =>
    page.context().addCookies([{ name: "STUB_SCENE", value: next, url: baseURL }]);
  if (scene) {
    await stand(scene);
  }
  const held = proposalForm("owner", scene);
  let version = held.proposal?.version ?? 0;

  await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, async (route) => {
    const request = route.request();
    if (request.method() !== "PUT") {
      return route.fallback();
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    const body = request.postDataJSON() as Saved;
    saves.push(body);
    version += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...held,
        proposal: {
          id: proposalId,
          status: scene === "sent" ? "sent" : "draft",
          approach: body.approach,
          deck: body.deckFileId ? proposalDeck : null,
          solutions: body.solutionIds.map(() => policyChat),
          team: body.team.map((row) => ({ ...row, email: "", name: null })),
          updatedAt: new Date().toISOString(),
          version,
        },
      }),
    });
  });
  await page.route(`**/api/proposal/use-case-proposals/${proposalId}/send`, async (route) => {
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    sends.push(route.request().method());
    await stand("sent");
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/identity/me/contact", async (route) => {
    contacts.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  // The popup of solutions reads the organization's list again each time it opens.
  await page.route("**/api/solution/mine", async (route) => {
    const [status, body] = answerWorkspace(new URL(route.request().url()), "owner") ?? [404, {}];
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  const uploads = await answerUploads(page, [proposalDeck.fileId]);

  return { saves, contacts, sends, uploads };
}

const pdf = {
  name: "deck.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
};

/** Axe reads the page with the pointer off the buttons: a pressed button's hover colour is not what is checked. */
async function settled(page: Page) {
  await page.mouse.move(0, 0);
  await expectNoSeriousA11yViolations(page);
}

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const steps = (page: Page) => page.getByRole("navigation", { name: "Steps of the use case" });

/**
 * Opens a step from the list of steps: the column beside the form, or on a phone the bar above it,
 * whose list is opened first.
 */
async function openStep(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    const bar = steps(page).getByRole("button", { name: /All steps/ });
    await expect(bar).toHaveAttribute("aria-expanded", "false");
    await bar.click();
    await expect(bar).toHaveAttribute("aria-expanded", "true");
  }
  await steps(page).getByRole("button", { name, exact: true }).click();
}

test.describe("a proposal to a use case", () => {
  test.use({ locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" });

  test("signing in comes first and returns to the form", async ({ page }) => {
    const visitor = await page.request.get(proposePath, { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe(
      `/sign-in?returnTo=${encodeURIComponent(proposePath)}`,
    );
  });

  test("a member writes a proposal step by step, it saves as it changes, and it is sent", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { saves, contacts, sends, uploads } = await fakeBackend(page, baseURL!);
    await page.goto(proposePath);

    // Step 1: the organization the proposal is sent for.
    await expect(heading(page)).toHaveText("Organization");
    await expect(page.getByText("Pocket Policy", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: a step that opens takes the focus on its heading; what it lacks is said under the
    // field, and the first field in error takes the focus.
    await expect(heading(page)).toHaveText("AI solutions");
    await expect(heading(page)).toBeFocused();
    if (isMobile) {
      await expect(
        steps(page).getByRole("button", { name: /^Step 2 of 6 · AI solutions/ }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Continue" }).click();
    const add = page.getByRole("button", { name: "Add solution" });
    await expect(page.getByText("Add at least one solution.")).toBeVisible();
    await expect(add).toBeFocused();
    await expect(add).toHaveAccessibleDescription("Add at least one solution.");
    const approach = page.getByLabel("How the solutions solve this use case");
    await expect(approach).toHaveAccessibleDescription(
      "Explain how the solutions solve this use case.",
    );
    await expect(heading(page)).toHaveText("AI solutions");
    expect(saves).toEqual([]);
    await settled(page);

    await add.click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("checkbox", { name: "Offer Policy Chat" }).click();
    await picker.getByRole("button", { name: "Add 1 solution" }).click();
    await expect(picker).toBeHidden();
    await expect(page.getByText("Add at least one solution.")).toHaveCount(0);
    await expect(page.getByText("1 solution", { exact: true })).toBeVisible();
    await approach.fill("Policy Chat reads each claim and names the team it belongs to.");
    // The draft is saved a moment after the last change, without a request from the person.
    await expect
      .poll(() => saves.at(-1))
      .toMatchObject({
        solutionIds: [policyChat.id],
        approach: "Policy Chat reads each claim and names the team it belongs to.",
        deckFileId: null,
        team: [],
      });
    expect(saves[0].version).toBeNull();
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: the details the account lacks; a number that cannot be one is said while it is typed.
    await expect(heading(page)).toHaveText("Your details");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Minh Trần");
    await page.getByRole("button", { name: "Continue" }).click();
    const country = page.getByLabel("Country");
    await expect(country).toBeFocused();
    await expect(country).toHaveAccessibleDescription("Required");
    const phone = page.getByLabel("Phone");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(contacts).toEqual([]);
    await country.selectOption({ label: "Vietnam" });
    await phone.fill("call me");
    await expect(phone).toHaveAccessibleDescription(
      "Use digits with the country code, such as +84 912 345 678.",
    );
    await phone.fill("+84 912 345 678");
    await expect(phone).not.toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: the team. Leaving the details kept them on the account.
    await expect(heading(page)).toHaveText("Team");
    expect(contacts).toEqual([{ country: "VN", phone: "+84 912 345 678", name: "Minh Trần" }]);
    await page.getByRole("button", { name: "Add member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Person").selectOption({ label: `${siti.name} · ${siti.email}` });
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog.getByLabel("Role")).toBeFocused();
    await expect(dialog.getByLabel("Role")).toHaveAccessibleDescription("Enter the role.");
    await dialog.getByLabel("Role").fill("Engineer");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Role of Siti Rahma")).toHaveValue("Engineer");
    // The first person of a team is its primary contact.
    await expect(
      page.getByRole("radio", { name: "Siti Rahma is the primary contact" }),
    ).toBeChecked();

    await page.getByRole("button", { name: "Add member" }).click();
    await dialog.getByLabel("Person").selectOption({ label: `${minh.name} · ${minh.email}` });
    await dialog.getByLabel("Role").fill("Lead");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByPlaceholder("Project lead")).toHaveCount(2);
    // When the primary contact leaves, the first who remains takes the place.
    await page.getByRole("button", { name: "Remove Siti Rahma" }).click();
    await expect(
      page.getByRole("radio", { name: "Minh Trần is the primary contact" }),
    ).toBeChecked();
    await expect
      .poll(() => saves.at(-1)?.team)
      .toEqual([{ accountId: minh.accountId, role: "Lead", primary: true }]);
    await settled(page);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: the PDF, uploaded at once and named by the next save.
    await expect(heading(page)).toHaveText("Proposal PDF");
    await page.getByRole("button", { name: "Continue" }).click();
    const choose = page.getByRole("button", { name: /Choose a PDF/ });
    await expect(page.getByText("Upload the proposal as a PDF.")).toBeVisible();
    await expect(choose).toBeFocused();
    await expect(heading(page)).toHaveText("Proposal PDF");
    await page.locator("#proposal-deck").setInputFiles(pdf);
    await expect(page.getByText("deck.pdf")).toBeVisible();
    await expect(page.getByText("Upload the proposal as a PDF.")).toHaveCount(0);
    expect(uploads).toEqual([expect.objectContaining({ fileName: "deck.pdf" })]);
    await expect.poll(() => saves.at(-1)?.deckFileId).toBe(proposalDeck.fileId);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: everything once more, then a confirmation before it goes.
    await expect(heading(page)).toHaveText("Review");
    await expect(page.getByText("Finish these steps before you send")).toHaveCount(0);
    await expect(
      page.getByText("Policy Chat reads each claim and names the team it belongs to."),
    ).toBeVisible();
    const send = page.getByRole("button", { name: "Send proposal" });
    await expect(send).toBeDisabled();
    await page
      .getByRole("checkbox", { name: /I confirm that what I am sending is accurate/ })
      .click();
    await settled(page);
    await send.click();

    await expect(page).toHaveURL(`${proposePath}/sent`);
    await expect(heading(page)).toHaveText("Your proposal was sent");
    expect(sends).toEqual(["POST"]);
    // The last save holds the whole proposal, with the version the one before it answered.
    expect(saves.at(-1)).toEqual({
      solutionIds: [policyChat.id],
      approach: "Policy Chat reads each claim and names the team it belongs to.",
      deckFileId: proposalDeck.fileId,
      team: [{ accountId: minh.accountId, role: "Lead", primary: true }],
      version: saves.length - 1,
    });
  });

  test("a stored draft is resumed as it was left, and the list of steps moves through it", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { saves } = await fakeBackend(page, baseURL!, "draft");
    await page.goto(proposePath);
    await expect(heading(page)).toHaveText("Organization");

    // Forward by the list of steps: the organization has nothing to check, so the team opens.
    await openStep(page, isMobile, "Team");
    await expect(heading(page)).toHaveText("Team");
    await expect(heading(page)).toBeFocused();
    if (isMobile) {
      const bar = steps(page).getByRole("button", { name: /All steps/ });
      await expect(bar).toHaveText(/Step 4 of 6 · Team/);
      await expect(bar).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(steps(page).getByRole("button", { name: "Team", exact: true })).toHaveAttribute(
        "aria-current",
        "step",
      );
    }
    // Both people of the draft are there, the one who has left the organization included.
    const roles = page.getByPlaceholder("Project lead");
    await expect(roles).toHaveCount(2);
    await expect(roles.first()).toHaveValue("Advisor");
    await expect(page.getByLabel("Role of Siti Rahma")).toHaveValue("Engineer");

    // The draft names no primary contact: the team says so and the choice takes the focus.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose one primary contact.")).toBeVisible();
    await expect(page.getByRole("radio").first()).toBeFocused();
    await expect(heading(page)).toHaveText("Team");
    // The same refusal by the list of steps, which goes forward as Continue does.
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Team");
    expect(saves).toEqual([]);
    await settled(page);

    await page.getByRole("radio", { name: "Siti Rahma is the primary contact" }).click();
    await expect(page.getByText("Choose one primary contact.")).toHaveCount(0);
    await expect
      .poll(() => saves.at(-1))
      .toEqual({
        solutionIds: [policyChat.id],
        approach: storedApproach,
        deckFileId: null,
        team: [
          { accountId: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a99", role: "Advisor", primary: false },
          { accountId: siti.accountId, role: "Engineer", primary: true },
        ],
        version: 4,
      });

    // Back is never refused, and shows what the draft held.
    await openStep(page, isMobile, "AI solutions");
    await expect(heading(page)).toHaveText("AI solutions");
    await expect(page.getByText("Policy Chat", { exact: true })).toBeVisible();
    await expect(page.getByLabel("How the solutions solve this use case")).toHaveValue(
      storedApproach,
    );

    await page.getByRole("button", { name: "Save and return later" }).click();
    await expect(page).toHaveURL(`/use-cases/${proposalUseCaseId}`);
    expect(saves).toHaveLength(1);
  });

  test("a sent proposal is edited, and nothing is saved until Save changes", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { saves, contacts } = await fakeBackend(page, baseURL!, "sent");
    await page.goto(proposePath);
    await expect(page.getByText("You are editing a sent proposal")).toBeVisible();
    await expect(page.getByText("No changes yet")).toBeVisible();

    await openStep(page, isMobile, "AI solutions");
    await page
      .getByLabel("How the solutions solve this use case")
      .fill("Policy Chat now also drafts the reply.");
    await expect(page.getByText("Changes not saved yet")).toBeVisible();

    // The account has no country or number yet, so the review names the step that lacks them.
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Review");
    await expect(page.getByText("Finish these steps before you send")).toBeVisible();
    const save = page.getByRole("button", { name: "Save changes" });
    await expect(save).toBeDisabled();
    await openStep(page, isMobile, "Your details");
    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone").fill("+84 912 345 678");
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Review");
    expect(contacts).toEqual([{ country: "VN", phone: "+84 912 345 678", name: "Minh Trần" }]);
    // Longer than the wait of a draft's save: a sent proposal is not saved as it changes.
    await page.waitForTimeout(1200);
    expect(saves).toEqual([]);

    await settled(page);
    await save.click();
    await expect(page.getByText("Your changes to the proposal were saved.")).toBeVisible();
    await expect(page).toHaveURL(`${proposePath}/view`);
    expect(saves).toEqual([
      {
        solutionIds: [policyChat.id],
        approach: "Policy Chat now also drafts the reply.",
        deckFileId: proposalDeck.fileId,
        team: [{ accountId: siti.accountId, role: "Engineer", primary: true }],
        version: 7,
      },
    ]);
  });
});
