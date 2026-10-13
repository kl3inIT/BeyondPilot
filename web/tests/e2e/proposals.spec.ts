import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { answerUploads } from "./stored-files";
import {
  policyChat,
  proposalDeck,
  proposalForm,
  proposalId,
  proposalUseCaseId,
} from "./stub-wizards.mjs";
import { answerWorkspace } from "./stub-workspace.mjs";

const proposePath = `/use-cases/${proposalUseCaseId}/propose`;
const storedApproach = "Policy Chat answers a policyholder's question from the policy itself.";

type Saved = {
  solutionIds: string[];
  approach: string;
  teamBackground: string;
  deckFileId: string | null;
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
          teamBackground: body.teamBackground || null,
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

  test("editing an organization refreshes its card and reopening reads the latest version", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeBackend(page, baseURL!, "draft");
    const [, mine] = answerWorkspace(new URL("http://stub/api/organization/mine"), "owner")!;
    let current = { ...mine.organization };
    const versions: number[] = [];
    await page.route("**/api/organization/mine", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...mine, organization: current }),
      }),
    );
    await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const form = proposalForm("owner", "draft");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...form,
          organization: { ...form.organization, name: current.name },
        }),
      });
    });
    await page.route("**/api/organization/mine/basics", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.version).toBe(current.version);
      versions.push(body.version);
      current = { ...current, ...body, version: current.version + 1 };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(current),
      });
    });
    await page.goto(proposePath);
    for (const name of ["Pocket Policy Updated", "Pocket Policy Latest"]) {
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Organization name")).toHaveValue(current.name);
      await dialog.getByLabel("Organization name").fill(name);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    expect(versions).toEqual([3, 4]);
    await settled(page);
  });

  test("a pending join request can be withdrawn and returns to the finder", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "asked", baseURL!);
    const [, mine] = answerWorkspace(new URL("http://stub/api/organization/mine"), "asked")!;
    let withdrawn = false;
    await page.route("**/api/organization/mine", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...mine, request: withdrawn ? null : mine.request }),
      }),
    );
    await page.route("**/api/organization/join-request/withdraw", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      withdrawn = true;
      await route.fulfill({ status: 204 });
    });
    await page.goto(proposePath);
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Withdraw the request" }).click();
    await expect(page.getByRole("button", { name: "Create a new organization" })).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await settled(page);
  });

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

    // Step 1: the organization the proposal is sent for, and who is sending; what the account
    // lacks is said under the field, and the first field in error takes the focus.
    await expect(heading(page)).toHaveText("You and your team");
    await expect(page.getByText("Pocket Policy", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Minh Trần");
    await page.getByRole("button", { name: "Continue" }).click();
    const country = page.getByLabel("Country");
    await expect(country).toBeFocused();
    await expect(country).toHaveAccessibleDescription("Required");
    const phone = page.getByLabel("Phone");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(contacts).toEqual([]);
    await country.selectOption({ label: "Vietnam" });
    // A number that cannot be one is said while it is typed.
    await phone.fill("call me");
    await expect(phone).toHaveAccessibleDescription(
      "Use digits with the country code, such as +84 912 345 678.",
    );
    await phone.fill("+84 912 345 678");
    await expect(phone).not.toHaveAttribute("aria-invalid", "true");
    await settled(page);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: a step that opens takes the focus on its heading. Leaving the first step kept the
    // details on the account.
    await expect(heading(page)).toHaveText("Your solution");
    await expect(heading(page)).toBeFocused();
    expect(contacts).toEqual([{ country: "VN", phone: "+84 912 345 678", name: "Minh Trần" }]);
    if (isMobile) {
      await expect(
        steps(page).getByRole("button", { name: /^Step 2 of 3 · Your solution/ }),
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
    await expect(heading(page)).toHaveText("Your solution");
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
      });
    await expect(page.getByText(/^Saved /)).toBeVisible();

    // The PDF is part of the step, uploaded at once and named by the next save.
    await page.getByRole("button", { name: "Continue" }).click();
    const choose = page.getByRole("button", { name: /Choose a PDF/ });
    await expect(page.getByText("Upload the proposal as a PDF.")).toBeVisible();
    await expect(choose).toBeFocused();
    await expect(heading(page)).toHaveText("Your solution");
    await page.locator("#proposal-deck").setInputFiles(pdf);
    await expect(page.getByText("deck.pdf")).toBeVisible();
    await expect(page.getByText("Upload the proposal as a PDF.")).toHaveCount(0);
    expect(uploads).toEqual([expect.objectContaining({ fileName: "deck.pdf" })]);
    await expect.poll(() => saves.at(-1)?.deckFileId).toBe(proposalDeck.fileId);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: everything once more, then a confirmation before it goes.
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
      teamBackground: "",
      deckFileId: proposalDeck.fileId,
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
    const { saves, contacts } = await fakeBackend(page, baseURL!, "draft");
    await page.goto(proposePath);
    await expect(heading(page)).toHaveText("You and your team");

    // The list of steps goes forward as Continue does: the details are missing, so the first
    // step refuses and the country takes the focus.
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("You and your team");
    await expect(page.getByLabel("Country")).toBeFocused();
    expect(saves).toEqual([]);
    await settled(page);

    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone").fill("+84 912 345 678");
    await openStep(page, isMobile, "Your solution");
    await expect(heading(page)).toHaveText("Your solution");
    await expect(heading(page)).toBeFocused();
    if (isMobile) {
      const bar = steps(page).getByRole("button", { name: /All steps/ });
      await expect(bar).toHaveText(/Step 2 of 3 · Your solution/);
      await expect(bar).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(
        steps(page).getByRole("button", { name: "Your solution", exact: true }),
      ).toHaveAttribute("aria-current", "step");
    }
    expect(contacts).toEqual([{ country: "VN", phone: "+84 912 345 678", name: "Minh Trần" }]);
    // What the draft held is there.
    await expect(page.getByText("Policy Chat", { exact: true })).toBeVisible();
    await expect(page.getByLabel("How the solutions solve this use case")).toHaveValue(
      storedApproach,
    );

    // The draft has no PDF: the step says so, and the choice takes the focus.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Upload the proposal as a PDF.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Choose a PDF/ })).toBeFocused();
    await expect(heading(page)).toHaveText("Your solution");
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Your solution");

    // Back is never refused.
    await openStep(page, isMobile, "You and your team");
    await expect(heading(page)).toHaveText("You and your team");
    await page.getByRole("button", { name: "Save and exit" }).click();
    await expect(page).toHaveURL(`/use-cases/${proposalUseCaseId}`);
    // Nothing was changed, so nothing was saved.
    expect(saves).toEqual([]);
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

    // The account has no country or number yet; going forward asks for them first.
    await openStep(page, isMobile, "Your solution");
    await expect(heading(page)).toHaveText("You and your team");
    await expect(page.getByLabel("Country")).toBeFocused();
    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone").fill("+84 912 345 678");
    await openStep(page, isMobile, "Your solution");
    await expect(heading(page)).toHaveText("Your solution");
    await page
      .getByLabel("How the solutions solve this use case")
      .fill("Policy Chat now also drafts the reply.");
    await expect(page.getByText("Changes not saved yet")).toBeVisible();

    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Review");
    await expect(page.getByText("Finish these steps before you send")).toHaveCount(0);
    const save = page.getByRole("button", { name: "Save changes" });
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
        teamBackground: "",
        deckFileId: proposalDeck.fileId,
        version: 7,
      },
    ]);
  });
});
