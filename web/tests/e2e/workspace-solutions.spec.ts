import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";
import { answerUploads, pixel, serveStoredImages } from "./stored-files";

const policyChat = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e11";
const claimsVision = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e12";
const fraudLens = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e13";
const quoteBot = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e14";
const sentBack = "be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f12";
const deckFile = "d0c1a2b3-4c5d-4e6f-8a9b-0c1d2e3f4a77";
const logoFile = "1090a2b3-4c5d-4e6f-8a9b-0c1d2e3f4a61";
const coverFile = "c0fea2b3-4c5d-4e6f-8a9b-0c1d2e3f4a62";

const list = "/workspace/organization/solutions";
const changesPath = "**/api/solution/mine**";

/** The solutions shown, by name, whichever layout the viewport has. */
function shownSolutions(page: Page) {
  return page.locator(`a[href^="${list}/"]:visible`);
}

/** One step of the editor of a solution, shown once its heading is. */
async function openEditor(page: Page, id: string, step?: "fit" | "evidence" | "review") {
  await page.goto(`${list}/${id}${step ? `?step=${step}` : ""}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

type Write = { call: string; body: Record<string, unknown> | null };

/**
 * Answers what the editor of one solution writes, as the backend would: a save with the solution as
 * saved at its next version, a submission with it waiting for review. Returns the writes it saw.
 */
async function answerEditor(page: Page, id: string, status: "draft" | "rejected") {
  const writes: Write[] = [];
  let saved: Record<string, unknown> = {};
  let version = 0;
  await page.route(`**/api/solution/mine/${id}**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fallback();
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    const body = request.postDataJSON() as Write["body"];
    writes.push({ call: `${request.method()} ${new URL(request.url()).pathname}`, body });
    if (request.method() === "DELETE") {
      return route.fulfill({ status: 204 });
    }
    const submitted = request.url().endsWith("/submit");
    if (body) {
      const { version: read, deckFileId, logoFileId, coverFileId, imageFileIds, ...fields } = body;
      version = Number(read) + 1;
      const image = (fileId: unknown, fileName: string) =>
        fileId ? { fileId, fileName, sizeBytes: 86016 } : null;
      saved = {
        ...fields,
        logo: image(logoFileId, "fraud-lens-logo.png"),
        cover: image(coverFileId, "fraud-lens-cover.png"),
        images: ((imageFileIds as string[] | undefined) ?? []).map((fileId, index) =>
          image(fileId, `fraud-lens-${index + 1}.png`),
        ),
        deck: deckFileId
          ? {
              fileId: deckFileId,
              fileName: "fraud-lens.pdf",
              sizeBytes: 2048,
              attachedAt: "2026-10-03T07:32:00Z",
            }
          : null,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
        organizationName: "Pocket Policy",
        slug: "fraud-lens",
        status: submitted ? "submitted" : status,
        complete: true,
        customerDeployments: [],
        submittedAt: null,
        updatedAt: "2026-10-03T07:32:00Z",
        ...saved,
        version,
      }),
    });
  });
  return writes;
}

/** Chooses one option of a field whose list narrows as a person types. */
async function choose(page: Page, field: string, typed: string, option: string) {
  await page.getByLabel(field).fill(typed);
  await page.getByRole("option", { name: option }).click();
}

test.describe("workspace solutions", () => {
  test.use({ locale: "en-US" });
  test.beforeEach(({ page }) => serveStoredImages(page));

  test("an owner reads the organization's solutions, each with where it stands", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(list);

    await expect(shownSolutions(page)).toHaveText([
      "Policy Chat",
      "Claims Vision",
      "Fraud Lens",
      "Quote Bot",
    ]);
    // Each says whether the public reads it, and what its owners do next.
    const shown = (text: string) => page.getByText(text, { exact: true }).locator("visible=true");
    await expect(shown("Listed")).toBeVisible();
    await expect(shown("Not public yet")).toBeVisible();
    await expect(shown("Draft · 1 of 7 required fields filled")).toBeVisible();
    await expect(shown("Sent back: It is Policy Chat under another name.")).toBeVisible();
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Actions for Policy Chat" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Edit",
      "View public page",
      "Copy link",
      "Hide from the directory",
    ]);
    await expect(page.getByRole("menuitem", { name: "View public page" })).toHaveAttribute(
      "href",
      "/solutions/policy-chat",
    );
    // Hiding asks first, and says what stays.
    await page.getByRole("menuitem", { name: "Hide from the directory" }).click();
    const hiding = page.getByRole("alertdialog", { name: "Hide from the directory?" });
    await expect(hiding.getByText("People with the link can still open it.")).toBeVisible();
    await hiding.getByRole("button", { name: "Cancel" }).click();

    // What is in review is read or edited; what was sent back is fixed and sent again.
    await page.getByRole("button", { name: "Actions for Claims Vision" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["View what was sent", /^Edit/]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Actions for Quote Bot" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Read the reason and fix", "Send again"]);
    await page.keyboard.press("Escape");

    // A draft that lacks what a review needs cannot be sent yet, and only a draft is deleted.
    await page.getByRole("button", { name: "Actions for Fraud Lens" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Continue editing",
      /^Send for review/,
      "Delete draft…",
    ]);
    await expect(page.getByRole("menuitem", { name: /Send for review/ })).toBeDisabled();
    await page.getByRole("menuitem", { name: "Delete draft…" }).click();
    await expect(page.getByRole("alertdialog", { name: "Delete Fraud Lens?" })).toBeVisible();
  });

  test("a member reads the solutions and changes none", async ({ page, context, baseURL }) => {
    await signInAs(context, "member", baseURL!);
    await page.goto(list);

    await expect(shownSolutions(page)).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Add a solution" })).toHaveCount(0);
    await page.getByRole("button", { name: "Actions for Fraud Lens" }).click();
    await page.getByRole("menuitem", { name: "Open" }).click();

    await expect(page).toHaveURL(`${list}/${fraudLens}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fraud Lens");
    await expect(page.getByText("Nothing written yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "All solutions" })).toHaveAttribute("href", list);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a deployment" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // What a solution holds beyond its text is read back too, with the way to its deck.
    await page.goto(`${list}/${policyChat}`);
    await expect(page.getByText("Vietnamese")).toBeVisible();
    await expect(page.getByText("PostgreSQL")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download the deck" })).toHaveAttribute(
      "href",
      "/api/solution/solutions/policy-chat/deck",
    );
  });

  test("a person without an organization is shown the ways into one", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto(list);

    await expect(page).toHaveURL("/workspace/organization");
    expect((await page.goto(`${list}/${policyChat}`))?.status()).toBe(404);
  });

  test("a solution starts with its name, as a draft", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 201, { id: fraudLens });
    await page.goto(list);

    await page.getByRole("button", { name: "Add a solution" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add solution" }).click();
    await expect(dialog.getByText("Enter the solution's name.")).toBeVisible();
    expect(changes).toEqual([]);

    await dialog.getByLabel("Solution name").fill("Fraud Lens");
    await dialog.getByRole("button", { name: "Add solution" }).click();

    await expect(page).toHaveURL(`${list}/${fraudLens}`);
    expect(changes).toEqual([{ call: "POST /api/solution/mine", body: { name: "Fraud Lens" } }]);
  });

  test("a draft is written in four steps, saves as it is typed and is sent from the review", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const writes = await answerEditor(page, fraudLens, "draft");
    const uploads = await answerUploads(page, [logoFile, coverFile]);
    await openEditor(page, fraudLens);

    // The editor stands alone: the site's navigation does not pull a person away mid-way.
    await expect(page.getByRole("link", { name: "AI talent" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Basics");
    await expect(page.getByText("All fields are required unless marked Optional.")).toBeVisible();
    if (!isMobile) {
      await expect(page.getByText("Only Pocket Policy sees a draft")).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Your solution" }).getByRole("button"),
      ).toHaveText([/Basics/, /Who it is for/, /Evidence/, /Review and submit/]);
    }
    await expectNoSeriousA11yViolations(page);

    // What is typed is saved without being asked.
    await expect(async () => {
      await page.getByLabel("What it does").fill("Finds claims that do not add up.");
      await expect(page.getByText("32 / 600")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByLabel("Stage").selectOption({ label: "Prototype" });
    await page.getByLabel("Built with").fill("Python");
    await page.getByLabel("Built with").press("Enter");
    await expect(page.getByRole("button", { name: "Remove Python" })).toBeVisible();
    await expect.poll(() => writes.length).toBeGreaterThan(0);
    await expect(page.getByRole("status").filter({ hasText: /Draft saved/ })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(`${list}/${fraudLens}?step=fit`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Who it is for");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await choose(page, "Industries", "insur", "Insurance");
    await choose(page, "AI capabilities", "predict", "Predictive analytics");
    await choose(page, "Languages", "viet", "Vietnamese");
    await page.getByRole("group", { name: "Where it runs" }).getByText("Cloud (SaaS)").click();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence");
    await expect(page.getByText("A logo and a cover image are needed for review.")).toBeVisible();
    // The two images a review asks for, each uploaded at once and shown with its name.
    const image = (place: string) =>
      page.locator(`[data-slot="image-upload"][data-place="${place}"] input[type="file"]`);
    await image("logo").setInputFiles({
      name: "fraud-lens-logo.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await expect(page.getByText("fraud-lens-logo.png")).toBeVisible();
    await image("cover").setInputFiles({
      name: "fraud-lens-cover.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await expect(page.getByText("fraud-lens-cover.png")).toBeVisible();
    expect(uploads.map((upload) => upload.purpose)).toEqual(["solution_logo", "solution_image"]);
    await expectNoSeriousA11yViolations(page);
    await page.getByLabel("Product demo").fill("https://fraudlens.example/demo");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review and submit");
    await expect(page.getByRole("note").getByText("Ready to send for review")).toBeVisible();
    await expect(page.getByText("Finds claims that do not add up.")).toBeVisible();
    await expect(page.getByText("Insurance", { exact: true })).toBeVisible();
    await expect(page.getByText("Not published yet").first()).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Send for review" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText("Send this solution for review?");
    await confirm.getByRole("button", { name: "Send for review" }).click();

    await expect(page.getByText("Sent to GenAI Fund for review.")).toBeVisible();
    await expect(page).toHaveURL(list);
    const saves = writes.filter((write) => write.call.startsWith("PUT"));
    expect(saves.at(-1)?.body).toMatchObject({
      name: "Fraud Lens",
      summary: "Finds claims that do not add up.",
      maturity: "prototype",
      builtWith: ["Python"],
      industries: ["insurance"],
      focusAreas: ["predictive_analytics"],
      languages: ["vi"],
      deployment: ["cloud_saas"],
      demoUrl: "https://fraudlens.example/demo",
      website: null,
      deckFileId: null,
      logoFileId: logoFile,
      coverFileId: coverFile,
      imageFileIds: [],
      listed: true,
    });
    // Each save carries the version the one before it answered with.
    expect(saves.map((write) => write.body?.version)).toEqual(saves.map((_, index) => index));
    expect(writes.at(-1)).toEqual({
      call: `POST /api/solution/mine/${fraudLens}/submit`,
      body: null,
    });
  });

  test("the review names what a draft lacks and leads to each field", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const writes = await answerEditor(page, fraudLens, "draft");
    await openEditor(page, fraudLens, "review");

    const readiness = page.getByRole("note").filter({ hasText: "Before you send it for review" });
    await expect(readiness.getByRole("button")).toHaveText([
      "What it does",
      "Stage",
      "Industries",
      "AI capabilities",
      "Logo",
      "Cover image",
    ]);
    await expect(page.getByRole("button", { name: "Send for review" })).toBeDisabled();
    await expect(page.getByText("Missing")).toHaveCount(6);
    await expect(page.getByText("2 to add")).toHaveCount(3);
    await expectNoSeriousA11yViolations(page);

    await expect(async () => {
      await readiness.getByRole("button", { name: "Stage" }).click();
      // The first step is the editor's own address.
      await expect(page).toHaveURL(`${list}/${fraudLens}`, { timeout: 1000 });
    }).toPass();
    await expect(page.getByLabel("Stage")).toBeFocused();
    await expect(page.getByText("Choose its stage.")).toBeVisible();
    await expect(page.getByText("Write two or three sentences about what it does.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    expect(writes).toEqual([]);
  });

  test("a link that is not an address is said under it and keeps the draft unsaved", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const writes = await answerEditor(page, fraudLens, "draft");
    await openEditor(page, fraudLens, "evidence");

    const demo = page.getByLabel("Product demo");
    await expect(async () => {
      await demo.fill("fraudlens.example/demo");
      await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
    await demo.blur();
    await expect(page.getByText("Enter a full address that starts with https://")).toBeVisible();
    expect(writes).toEqual([]);

    await demo.fill("https://fraudlens.example/demo");
    await expect(page.getByText("Enter a full address that starts with https://")).toHaveCount(0);
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body).toMatchObject({ demoUrl: "https://fraudlens.example/demo" });
  });

  test("a deck is uploaded as a PDF and named by the save that follows", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const writes = await answerEditor(page, fraudLens, "draft");
    const uploads = await answerDecisions(page, "**/api/storage/uploads", 201, {
      id: deckFile,
      method: "PUT",
      url: `/api/storage/uploads/${deckFile}/content?token=once`,
      headers: {},
      expiresAt: "2026-10-03T08:00:00Z",
    });
    await page.route(`**/api/storage/uploads/${deckFile}/content**`, (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.route(`**/api/storage/uploads/${deckFile}/confirm`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: deckFile,
          fileName: "fraud-lens.pdf",
          mediaType: "application/pdf",
          sizeBytes: 2048,
        }),
      }),
    );
    await openEditor(page, fraudLens, "evidence");
    await expect(page.getByRole("button", { name: /Upload the deck/ })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Anything but a PDF is refused before it is sent.
    const file = page.locator('[data-slot="deck-upload"] input[type="file"]');
    await file.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(page.getByText("Only a PDF can be uploaded here.")).toBeVisible();
    expect(uploads).toEqual([]);

    await file.setInputFiles({
      name: "fraud-lens.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n"),
    });
    await expect(page.getByText("fraud-lens.pdf")).toBeVisible();
    expect(uploads[0].body).toMatchObject({ purpose: "solution_deck", fileName: "fraud-lens.pdf" });
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body).toMatchObject({ deckFileId: deckFile });
    // Once the solution names the file, its row is the way to read it.
    await expect(page.getByRole("link", { name: "Download fraud-lens.pdf" })).toHaveAttribute(
      "href",
      "/api/solution/solutions/fraud-lens/deck",
    );

    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("button", { name: /Upload the deck/ })).toBeVisible();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body).toMatchObject({ deckFileId: null });
  });

  test("a draft is deleted only after a confirmation", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await openEditor(page, fraudLens, "review");

    await expect(async () => {
      await page.getByRole("button", { name: "Delete draft…" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 1000 });
    }).toPass();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText("Delete Fraud Lens?");
    await confirm.getByRole("button", { name: "Delete draft" }).click();

    await expect(page.getByText("Fraud Lens deleted.")).toBeVisible();
    await expect(page).toHaveURL(list);
    expect(changes).toEqual([{ call: `DELETE /api/solution/mine/${fraudLens}`, body: null }]);
  });

  test("a solution in review, and one sent back, say so with what happens next", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await openEditor(page, claimsVision, "review");

    await expect(page.getByText("GenAI Fund is reviewing this solution")).toBeVisible();
    // What is in review is read by others: it is saved when asked, not sent or deleted.
    await expect(page.getByRole("button", { name: "Save changes" }).first()).toBeDisabled();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review");
    await expect(page.getByRole("button", { name: "Send for review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete draft…" })).toHaveCount(0);

    await openEditor(page, quoteBot, "review");
    await expect(page.getByText("Changes needed: Already listed")).toBeVisible();
    await expect(page.getByText("It is Policy Chat under another name.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send for review again" })).toBeEnabled();
    await expectNoSeriousA11yViolations(page);
  });

  test("a stale save of an approved solution is told by its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(
      page,
      changesPath,
      409,
      refusal("SOLUTION_CHANGED_MEANWHILE"),
    );
    await openEditor(page, policyChat);

    await expect(page.getByText("Approved and listed in the directory")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the public page" })).toHaveAttribute(
      "href",
      "/solutions/policy-chat",
    );
    const save = page.getByRole("button", { name: "Save changes" });
    await expect(async () => {
      await page.getByLabel("What it does").fill("Answers policy holders in seconds.");
      await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass();
    // An approved solution is read by anyone, so nothing is sent until the person asks.
    await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
    expect(changes).toEqual([]);
    await save.click();

    await expect(
      page.getByText("Someone else changed this solution. Reload the page and try again."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });

  test("an owner adds a customer deployment, which goes to review, and removes one", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await openEditor(page, policyChat, "evidence");

    const deployments = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Customer deployments" }) })
      .last();
    await expect(deployments.getByRole("heading", { level: 3 })).toHaveText([
      "Renewals at Mekong Life",
      "Claims line at Bảo An",
    ]);
    await expect(
      deployments.getByText("Sent back: Could not be verified. Who can confirm it?"),
    ).toBeVisible();
    // The deck the solution names is read from its row.
    await expect(page.getByRole("link", { name: "Download policy-chat-deck.pdf" })).toHaveAttribute(
      "href",
      "/api/solution/solutions/policy-chat/deck",
    );
    await expect(page.getByText("3.1 MB · Uploaded Oct 1, 10:00")).toBeVisible();

    await expect(async () => {
      await deployments.getByRole("button", { name: "Add a deployment" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText("Add a customer deployment");
    await expectNoSeriousA11yViolations(page);
    await dialog.getByLabel("Title").fill("Voice agent for claims");
    await dialog.getByLabel("Customer").fill("A retail bank in Vietnam");
    await dialog.getByLabel("Stage").selectOption({ label: "In pilot" });
    await dialog.getByLabel("The business problem").fill("Callers waited ten minutes.");
    await dialog.getByLabel("What was deployed").fill("A voice agent on the claims line.");
    await dialog.getByLabel("Result (optional)").fill("Half of calls answered at once.");
    await dialog.getByRole("button", { name: "Send for review" }).click();

    await expect(
      page.getByText("Voice agent for claims sent to GenAI Fund for review."),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);

    await deployments.getByRole("button", { name: "Remove" }).last().click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText("Remove Claims line at Bảo An?");
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Claims line at Bảo An removed.")).toBeVisible();

    expect(changes).toEqual([
      {
        call: `POST /api/solution/mine/${policyChat}/deployments`,
        body: {
          title: "Voice agent for claims",
          customer: "A retail bank in Vietnam",
          problem: "Callers waited ten minutes.",
          delivered: "A voice agent on the claims line.",
          stage: "pilot",
          channels: null,
          languages: null,
          period: null,
          result: "Half of calls answered at once.",
          version: null,
        },
      },
      {
        call: `DELETE /api/solution/mine/${policyChat}/deployments/${sentBack}`,
        body: null,
      },
    ]);
  });
});
