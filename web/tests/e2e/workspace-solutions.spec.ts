import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const policyChat = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e11";
const claimsVision = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e12";
const fraudLens = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e13";
const quoteBot = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e14";
const sentBack = "be6b8fa7-5e53-4fa8-8fa0-5c8e1e1a2f12";

const list = "/workspace/organization/solutions";
const changesPath = "**/api/solution/mine**";

/** The solutions shown, by name, whichever layout the viewport has. */
function shownSolutions(page: Page) {
  return page.locator(`a[href^="${list}/"]:visible`);
}

/** The form of a solution, once it answers a change: text typed before that is not the form's yet. */
async function openEditor(page: Page, id: string) {
  await page.goto(`${list}/${id}`);
  await expect(page.getByRole("link", { name: "All solutions" })).toBeVisible();
}

test.describe("workspace solutions", () => {
  test.use({ locale: "en-US" });

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
    await expect(page.getByText("1 listed · 1 draft · 1 in review · 1 not approved")).toBeVisible();
    await expect(page.getByText("Listed in the directory").locator("visible=true")).toBeVisible();
    await expect(
      page.getByText("Not submitted · visible to your organization only").locator("visible=true"),
    ).toBeVisible();
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Actions for Policy Chat" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit", "View public page"]);
    await expect(page.getByRole("menuitem", { name: "View public page" })).toHaveAttribute(
      "href",
      "/solutions/policy-chat",
    );
    await page.keyboard.press("Escape");

    // Only what is listed has a public page.
    await page.getByRole("button", { name: "Actions for Fraud Lens" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit"]);
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
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send for review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add a deployment" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
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

  test("a draft says what review needs, and is sent once it has it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await openEditor(page, fraudLens);

    const readiness = page.getByRole("note").filter({ hasText: "Before you send it for review" });
    await expect(readiness.getByRole("button")).toHaveText([
      "Summary",
      "Focus areas",
      "Industries",
      "Maturity",
    ]);
    await expect(page.getByRole("button", { name: "4 fields to add before review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    await expect(async () => {
      await page.getByRole("button", { name: "Send for review" }).click();
      await expect(page.getByText("Write one or two sentences about what it does.")).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
    await expect(
      page.getByText("Fill in the marked fields before sending for review.").first(),
    ).toBeVisible();
    await expect(page.getByLabel("Summary")).toBeFocused();
    await expect(page.getByText("Choose how mature it is.")).toBeVisible();
    expect(changes).toEqual([]);

    await page.getByLabel("Summary").fill("Finds claims that do not add up.");
    await page
      .getByRole("group", { name: "Focus areas" })
      .getByText("Predictive analytics")
      .click();
    await page.getByRole("group", { name: "Industries" }).getByText("Insurance").click();
    await page.getByLabel("Maturity").selectOption({ label: "Prototype" });
    await expect(page.getByRole("note").getByText("Ready to send for review")).toBeVisible();
    await expect(page.getByText("Unsaved changes")).toBeVisible();

    await page.getByRole("button", { name: "Send for review" }).click();

    await expect(page.getByText("Sent to GenAI Fund for review.")).toBeVisible();
    expect(changes).toEqual([
      {
        call: `PUT /api/solution/mine/${fraudLens}`,
        body: {
          name: "Fraud Lens",
          summary: "Finds claims that do not add up.",
          problemsSolved: null,
          valueProposition: null,
          website: null,
          focusAreas: ["predictive_analytics"],
          industries: ["insurance"],
          deployment: [],
          deckFileId: null,
          demoUrl: null,
          builtWith: [],
          traction: null,
          maturity: "prototype",
          listed: true,
          version: 0,
        },
      },
      { call: `POST /api/solution/mine/${fraudLens}/submit`, body: null },
    ]);
  });

  test("a draft is deleted only after a confirmation", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 204);
    await openEditor(page, fraudLens);

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
    await openEditor(page, claimsVision);

    await expect(page.getByText("GenAI Fund is reviewing this solution")).toBeVisible();
    // What is in review is no longer a draft: it is saved, not sent or deleted.
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send for review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete draft…" })).toHaveCount(0);

    await openEditor(page, quoteBot);
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
    await answerDecisions(page, changesPath, 409, refusal("SOLUTION_CHANGED_MEANWHILE"));
    await openEditor(page, policyChat);

    await expect(page.getByText("Approved and listed in the directory")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the public page" })).toHaveAttribute(
      "href",
      "/solutions/policy-chat",
    );
    const save = page.getByRole("button", { name: "Save changes" });
    await expect(async () => {
      await page.getByLabel("Summary").fill("Answers policy holders in seconds.");
      await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass();
    await save.click();

    await expect(
      page.getByText("Someone else changed this solution. Reload the page and try again."),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });

  test("an owner adds a customer deployment, which goes to review, and removes one", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await openEditor(page, policyChat);

    const deployments = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Customer deployments" }) });
    await expect(deployments.getByRole("heading", { level: 3 })).toHaveText([
      "Renewals at Mekong Life",
      "Claims line at Bảo An",
    ]);
    await expect(
      deployments.getByText("Sent back: Could not be verified. Who can confirm it?"),
    ).toBeVisible();

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
