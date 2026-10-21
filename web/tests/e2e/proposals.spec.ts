import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { answerUploads, serveStoredPdf } from "./stored-files";
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
async function fakeBackend(
  page: Page,
  baseURL: string,
  scene?: "draft" | "sent" | "shortlisted" | "declined" | "withdrawn" | "closed",
) {
  const saves: Saved[] = [];
  const contacts: unknown[] = [];
  const sends: string[] = [];
  const withdraws: string[] = [];
  const stand = (next: string) =>
    page.context().addCookies([{ name: "STUB_SCENE", value: next, url: baseURL }]);
  if (scene) {
    await stand(scene);
  }
  const held = proposalForm("owner", scene);
  let version = held.proposal?.version ?? 0;

  await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(proposalForm("owner", scene)),
      });
    }
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
  await page.route(`**/api/proposal/use-case-proposals/${proposalId}/withdraw`, async (route) => {
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    withdraws.push(route.request().method());
    await stand("withdrawn");
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

  return { saves, contacts, sends, withdraws, uploads };
}

const pdf = {
  name: "deck.pdf",
  mimeType: "application/pdf",
  // A real PDF, so that the viewer can read what was just uploaded.
  buffer: readFileSync(join(__dirname, "fixtures", "deck.pdf")),
};

/**
 * Opens a PDF in the full-screen viewer and reads it: every page, the download still at hand, and
 * Escape gives the focus back to Open.
 */
async function openInViewer(page: Page, name: string, download?: string) {
  const open = page.getByRole("button", { name: `Open ${name}` });
  await open.click();
  const viewer = page.getByRole("dialog", { name });
  await expect(viewer.getByRole("group", { name: /^Page \d$/ })).toHaveCount(3);
  const link = viewer.getByRole("link", { name: "Download" });
  if (download) {
    await expect(link).toHaveAttribute("href", download);
  } else {
    await expect(link).toBeVisible();
  }
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(open).toBeFocused();
}

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

/** Holds the organization a quick-create returns so the wizard's explicit refetch sees it. */
async function watchQuickCreate(page: Page) {
  const [, mine] = answerWorkspace(new URL("http://stub/api/organization/mine"), "invited")!;
  let organization: Record<string, unknown> | null = null;
  const creations: Record<string, unknown>[] = [];
  await page.route("**/api/organization/mine", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...mine, organization, role: organization ? "owner" : null }),
    }),
  );
  await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...proposalForm("invited"),
        organization: organization ? { ...organization, approved: true, owner: true } : null,
      }),
    }),
  );
  await page.route("**/api/organization/organizations/basics", async (route) => {
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    const body = route.request().postDataJSON();
    creations.push(body);
    organization = {
      ...body,
      id: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c08",
      version: 0,
      logoFileId: null,
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(organization),
    });
  });
  return creations;
}

test.describe("a proposal to a use case", () => {
  test.use({ locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" });

  for (const kind of ["Just me", "A company"] as const) {
    test(`quick-create submits ${kind} with its required facts`, async ({
      page,
      context,
      baseURL,
    }) => {
      await signInAs(context, "invited", baseURL!);
      const creations = await watchQuickCreate(page);
      await page.goto(proposePath);
      await page.getByRole("button", { name: "Create a new organization" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: kind, exact: true }).click();
      await expect(dialog.getByRole("textbox")).toHaveCount(kind === "Just me" ? 1 : 4);
      await expect(dialog.getByRole("combobox")).toHaveCount(kind === "Just me" ? 1 : 3);
      await expect(dialog.getByText("Logo", { exact: true })).toHaveCount(0);
      await dialog
        .getByRole("textbox", {
          name: kind === "Just me" ? "Your name" : "Organization name",
          exact: true,
        })
        .fill("Doc Studio");
      await dialog.getByRole("combobox", { name: "Country" }).click();
      await page.getByRole("option", { name: "Vietnam", exact: true }).click();
      if (kind === "A company") {
        await dialog
          .getByRole("textbox", { name: "Website", exact: true })
          .fill("https://doc.example");
        await dialog.getByRole("combobox", { name: "Team size" }).click();
        await page.getByRole("option", { name: "2–9 people", exact: true }).click();
        await dialog.getByRole("combobox", { name: "Industries" }).fill("Insurance");
        await page.getByRole("option", { name: "Insurance", exact: true }).click();
        await dialog.getByRole("textbox", { name: "Year founded", exact: true }).fill("2021");
        await dialog
          .getByRole("textbox", { name: "Short description", exact: true })
          .fill("Insurance document assistants.");
      }
      await settled(page);
      await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Doc Studio", { exact: true })).toBeVisible();
      expect(creations).toEqual([
        {
          name: "Doc Studio",
          country: "VN",
          version: null,
          type: kind === "Just me" ? "independent_builder" : "company",
          teamSize: kind === "Just me" ? "just_me" : "2_9",
          industries: kind === "Just me" ? [] : ["insurance"],
          website: kind === "Just me" ? null : "https://doc.example",
          foundedYear: kind === "Just me" ? null : 2021,
          description: kind === "Just me" ? null : "Insurance document assistants.",
        },
      ]);
    });
  }

  test("quick-create shows only required fields for each type and creates a team without background", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "invited", baseURL!);
    const creations = await watchQuickCreate(page);
    await page.goto(proposePath);
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Create a new organization" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Organization name").fill("Doc Team");
    await dialog.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Vietnam", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Website", exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Year founded")).toBeVisible();
    await expect(dialog.getByLabel("Short description")).toBeVisible();
    await expect(dialog.getByLabel("Team background")).toHaveCount(0);
    await expect(dialog.getByText("Optional", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
    await expect(dialog.getByText("Choose at least one industry.")).toBeVisible();
    await dialog.getByRole("textbox", { name: "Website", exact: true }).fill("https://doc.example");
    await dialog.getByRole("radio", { name: "Just me", exact: true }).click();
    await expect(dialog.getByLabel("Your name")).toHaveValue("Doc Team");
    for (const label of [
      "Website",
      "Year founded",
      "Short description",
      "Team size",
      "Industries",
    ]) {
      await expect(dialog.getByLabel(label)).toHaveCount(0);
    }
    await settled(page);
    await dialog.getByRole("radio", { name: "A team", exact: true }).click();
    await expect(dialog.getByRole("textbox")).toHaveCount(2);
    await expect(dialog.getByRole("combobox")).toHaveCount(2);
    await expect(dialog.getByRole("textbox", { name: "Website", exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel("Year founded")).toHaveCount(0);
    await expect(dialog.getByRole("combobox", { name: "Industries", exact: true })).toHaveCount(0);
    await dialog.getByRole("combobox", { name: "Team size" }).click();
    await page.getByRole("option", { name: "2–9 people", exact: true }).click();
    await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
    await expect(dialog.getByLabel("Short description")).toBeFocused();
    await dialog.getByLabel("Short description").fill("Built document assistants.");
    await dialog.getByRole("radio", { name: "A company", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Website", exact: true })).toHaveValue(
      "https://doc.example",
    );
    await dialog.getByRole("radio", { name: "A team", exact: true }).click();
    await settled(page);
    const dimensions = await dialog.evaluate((element) => ({
      width: element.clientWidth,
      content: element.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    await dialog.getByRole("button", { name: "Create organization", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Doc Team", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Team background")).toHaveValue("");
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
    expect(creations).toEqual([
      {
        name: "Doc Team",
        type: "builder_team",
        teamSize: "2_9",
        industries: [],
        country: "VN",
        website: null,
        foundedYear: null,
        description: "Built document assistants.",
        version: null,
      },
    ]);
    await settled(page);
  });

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
      // Any organization may be a team, a company or just its owner, so the three choices stay.
      await expect(dialog.getByRole("radio", { name: "Just me", exact: true })).toHaveCount(1);
      await expect(dialog.getByRole("radio")).toHaveCount(3);
      await dialog.getByLabel("Organization name").fill(name);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    expect(versions).toEqual([3, 4]);
    await settled(page);
  });

  test("the owner of a Just me organization edits it and reaches My organization like any other", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "alone", baseURL!);
    await fakeBackend(page, baseURL!, "draft");
    await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: proposalForm("alone", "draft") })
        : route.fallback(),
    );
    await page.goto(proposePath);
    await expect(heading(page)).toHaveText("You and your team");
    await expect(page.getByText("An Tr?n", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My organization", exact: true })).toHaveAttribute(
      "href",
      "/workspace/organization",
    );
    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone").fill("+84 912 345 678");
    await openStep(page, isMobile, "Review");
    await expect(heading(page)).toHaveText("Review");
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "My organization", exact: true })).toBeVisible();
    await settled(page);
  });

  test("a pending join request can be withdrawn and returns to the finder", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "asked", baseURL!);
    await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/proposal`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(proposalForm("asked")),
      }),
    );
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
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My organization", exact: true })).toHaveAttribute(
      "href",
      "/workspace/organization",
    );
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
    // What was just uploaded opens at once, from the browser's own copy.
    await openInViewer(page, "deck.pdf");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: everything once more, then a confirmation before it goes.
    await expect(heading(page)).toHaveText("Review");
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "My organization", exact: true })).toHaveAttribute(
      "href",
      "/workspace/organization",
    );
    await expect(page.getByText("Finish these steps before you send")).toHaveCount(0);
    await expect(
      page.getByText("Policy Chat reads each claim and names the team it belongs to."),
    ).toBeVisible();
    // The review reads the PDF the same way.
    await openInViewer(page, "deck.pdf");
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

  test("a sent proposal is taken back after asking, and may be sent again", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { withdraws } = await fakeBackend(page, baseURL!, "sent");
    await page.goto(`${proposePath}/view`);
    await expect(heading(page)).toHaveText("Pocket Policy");
    await expect(page.getByRole("link", { name: "Edit proposal" })).toBeVisible();

    // Asking comes first: keeping the proposal closes the dialog and sends nothing.
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: "Withdraw this proposal?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Claims triage with document intelligence")).toBeVisible();
    await expect(dialog.getByText("until the use case closes on")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep proposal" })).toBeFocused();
    await settled(page);
    await dialog.getByRole("button", { name: "Keep proposal" }).click();
    await expect(dialog).toBeHidden();
    expect(withdraws).toEqual([]);

    // Withdrawing leaves the proposal read, says so, and offers sending it again.
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    await dialog.getByRole("button", { name: "Withdraw proposal" }).click();
    await expect.poll(() => withdraws).toEqual(["POST"]);
    await expect(page.getByText("You withdrew this proposal")).toBeVisible();
    await expect(page.getByText("Withdrawn 12 Oct 2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Send again" })).toHaveAttribute(
      "href",
      proposePath,
    );
    await settled(page);
  });

  test("a proposal to a use case that closed cannot be taken back", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeBackend(page, baseURL!, "closed");
    await page.goto(`${proposePath}/view`);
    await expect(page.getByText("This use case is closed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit proposal" })).toHaveCount(0);
    await settled(page);
  });
});

const receivedPath = `/workspace/organization/use-cases/${proposalUseCaseId}/proposals`;

/**
 * Answers what the browser writes while a use case's proposals are decided, as the backend would;
 * a decision moves the stub to `decided` and sending to `told`, so the page that follows reads them.
 */
async function fakeDecisions(page: Page, baseURL: string, scene: "received" | "decided" | "told") {
  const decisions: { id: string; body: unknown }[] = [];
  const sends: unknown[] = [];
  const stand = (next: string) =>
    page.context().addCookies([{ name: "STUB_SCENE", value: next, url: baseURL }]);
  await stand(scene);
  await page.route("**/api/proposal/use-case-proposals/*/decision", async (route) => {
    const request = route.request();
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    decisions.push({ id: request.url().split("/").at(-2)!, body: request.postDataJSON() });
    await stand("decided");
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route(`**/api/proposal/use-cases/${proposalUseCaseId}/outcomes`, async (route) => {
    const request = route.request();
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    sends.push(request.postDataJSON());
    await stand("told");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sent: 2, shortlisted: 1, declined: 1 }),
    });
  });
  return { decisions, sends };
}

const tab = (page: Page, name: string, count: number) =>
  page
    .getByRole("navigation", { name: "Filter proposals" })
    .getByRole("link", { name: new RegExp(`^${name} ?${count}$`) });

test.describe("the proposals a use case received", () => {
  test("recipients see proposal decisions, not the sender organization's review status", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    await fakeDecisions(page, baseURL!, "received");
    await page.goto(receivedPath);
    const row = page.getByRole("row").filter({
      has: page.getByRole("link", { name: "Orbit Claims", exact: true }),
    });
    const name = row.getByRole("link", { name: "Orbit Claims", exact: true });
    await expect(page.getByText("Taken down", { exact: true })).toHaveCount(0);
    await expect(row.getByText("Not decided", { exact: true })).toBeVisible();
    expect(await name.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
    const nameBox = await name.boundingBox();
    expect(nameBox).not.toBeNull();
    const detail = row.getByText(/^Policy Chat ·/);
    await expect(detail).toBeVisible();
    expect((await detail.boundingBox())!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height);
    expect(
      await row
        .locator("td")
        .first()
        .evaluate((cell) => cell.scrollWidth - cell.clientWidth),
    ).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await settled(page);
    await page.screenshot({ path: testInfo.outputPath("received-proposals.png"), fullPage: true });
    await page.goto((await name.getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orbit Claims");
    await expect(page.getByText("Taken down", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Not decided", { exact: true })).toBeVisible();
    await settled(page);
  });

  test("a reviewer marks proposals from the list, reads them by tab, and sends the outcomes", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { decisions, sends } = await fakeDecisions(page, baseURL!, "received");
    await page.goto(receivedPath);
    await expect(heading(page)).toHaveText("Claims triage with document intelligence");
    await expect(tab(page, "All", 3)).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Not decided")).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^Send outcomes/ })).toBeDisabled();
    await settled(page);

    // Marking only saves: no popup, nobody is told.
    await page.getByRole("button", { name: "Actions for Orbit Claims" }).click();
    await page.getByRole("menuitem", { name: "Shortlist" }).click();
    await expect.poll(() => decisions.length).toBe(1);
    expect(decisions[0]).toEqual({
      id: "7a1d2c3b-0000-4000-8000-000000000063",
      body: { decision: "shortlisted" },
    });
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // The stub now holds two decisions that were not sent: the counts follow the response.
    await expect(tab(page, "Shortlisted", 1)).toBeVisible();
    await expect(tab(page, "Declined", 1)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send outcomes (2)" })).toBeVisible();
    await tab(page, "Declined", 1).click();
    await expect(page).toHaveURL(/\?tab=declined$/);
    await expect(page.getByRole("link", { name: "Lumen AI" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Northwind Analytics" })).toHaveCount(0);
    await tab(page, "All", 3).click();
    await expect(page.getByRole("link", { name: "Northwind Analytics" })).toBeVisible();

    // Sending asks first, says what goes out, and takes one note for every email.
    await page.getByRole("button", { name: "Send outcomes (2)" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Send outcomes to providers?" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("1 shortlisted and 1 declined will each get one email."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByLabel("Message in every email (optional)").fill("Thank you for applying.");
    await settled(page);
    await dialog.getByRole("button", { name: "Send 2 outcomes" }).click();
    await expect.poll(() => sends).toEqual([{ message: "Thank you for applying." }]);
    await expect(dialog).toBeHidden();
    await expect(page.getByText("2 outcomes were sent.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send outcomes (0)" })).toBeDisabled();
    await settled(page);
  });

  test("the PDF of a proposal opens in the page, and is still downloaded", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeDecisions(page, baseURL!, "received");
    const id = "7a1d2c3b-0000-4000-8000-000000000061";
    const file = `/api/proposal/use-case-proposals/${id}/file`;
    await serveStoredPdf(page, `**${file}`, proposalDeck.fileName);
    await page.goto(`${receivedPath}/${id}`);
    await expect(heading(page)).toHaveText("Northwind Analytics");
    const download = page.getByRole("link", { name: "Download PDF" });
    await expect(download).toHaveAttribute("href", file);
    await expectNoSeriousA11yViolations(page);

    await openInViewer(page, proposalDeck.fileName, file);
    // Opening it left the page as it was, and the download is still there.
    await expect(download).toBeVisible();
  });

  test("a reviewer decides from the proposal itself, and may change it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { decisions } = await fakeDecisions(page, baseURL!, "received");
    await page.goto(`${receivedPath}/7a1d2c3b-0000-4000-8000-000000000061`);
    await expect(heading(page)).toHaveText("Northwind Analytics");
    await expect(page.getByText("Your assessment")).toBeVisible();
    await expect(page.getByText("Not decided")).toBeVisible();
    await settled(page);

    await page.getByRole("button", { name: "Shortlist", exact: true }).click();
    await expect
      .poll(() => decisions.map((entry) => entry.body))
      .toEqual([{ decision: "shortlisted" }]);
    await expect(page.getByText("Hoa Lê on")).toBeVisible();
    // What is decided is not offered again; the other choice stays.
    await expect(page.getByRole("button", { name: "Shortlist", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Decline", exact: true })).toBeEnabled();
    await settled(page);
  });
});

test.describe("what the sender of a proposal is told", () => {
  test("a shortlisted proposal says so and keeps Withdraw", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeBackend(page, baseURL!, "shortlisted");
    await page.goto(`${proposePath}/view`);
    await expect(page.getByText("Your proposal was shortlisted")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toBeVisible();
    await settled(page);

    await page.goto(`/use-cases/${proposalUseCaseId}`);
    await expect(page.getByText("shortlisted your proposal on 13 Oct 2026")).toBeVisible();
    await expect(page.getByText("Shortlisted", { exact: true })).toBeVisible();
    await settled(page);
  });

  test("the sender opens the PDF of a proposal that was sent", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeBackend(page, baseURL!, "sent");
    const file = `/api/proposal/use-cases/${proposalUseCaseId}/proposal/file`;
    await serveStoredPdf(page, `**${file}`, proposalDeck.fileName);
    await page.goto(`${proposePath}/view`);
    await expect(page.getByText(proposalDeck.fileName)).toBeVisible();
    await settled(page);

    await openInViewer(page, proposalDeck.fileName, file);
  });

  test("a proposal that was not selected is only read", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    await fakeBackend(page, baseURL!, "declined");
    await page.goto(`${proposePath}/view`);
    await expect(page.getByText("Your proposal was not selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit proposal" })).toHaveCount(0);
    await settled(page);

    await page.goto(`/use-cases/${proposalUseCaseId}`);
    await expect(page.getByText("Not selected", { exact: true })).toBeVisible();
    await expect(page.getByText("The outcome was sent to your email on 13 Oct 2026")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit proposal" })).toHaveCount(0);
    await settled(page);
  });
});
