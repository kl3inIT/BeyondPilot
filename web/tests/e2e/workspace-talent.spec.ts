import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const mine = "/workspace/talent";
const changesPath = "**/api/talent/mine**";

test.describe("workspace talent profile", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in and back", async ({ page }) => {
    const answer = await page.request.get(mine, { maxRedirects: 0 });

    expect(answer.status()).toBe(307);
    expect(answer.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(mine)}`);
  });

  test("a first profile starts from the account's name and says what review needs", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await page.goto(mine);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your talent profile");
    await expect(
      page.getByText(
        "Tell companies what you build. GenAI Fund reviews the profile before it is listed.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Minh Trần");
    const readiness = page.getByRole("note").filter({ hasText: "Before you send it for review" });
    await expect(readiness.getByRole("button")).toHaveText([
      "Headline",
      "About you",
      "Roles",
      "Skills",
    ]);
    await expectNoSeriousA11yViolations(page);

    await expect(async () => {
      await page.getByRole("button", { name: "Send for review" }).click();
      await expect(page.getByText("Say what you do in one line.")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page.getByLabel("Headline")).toBeFocused();
    expect(changes).toEqual([]);

    await page.getByLabel("Headline").fill("Founder building assistants for insurers");
    await page.getByLabel("About you").fill("Ten years in insurance operations.");
    await page.getByRole("group", { name: "Roles" }).getByText("AI engineer").click();
    await page.getByLabel("Skills").fill("Python, RAG ,  ");
    await expect(page.getByRole("note").getByText("Ready to send for review")).toBeVisible();

    await page.getByRole("button", { name: "Send for review" }).click();

    await expect(page.getByText("Sent to GenAI Fund for review.")).toBeVisible();
    expect(changes).toEqual([
      {
        call: "PUT /api/talent/mine",
        body: {
          name: "Minh Trần",
          headline: "Founder building assistants for insurers",
          bio: "Ten years in insurance operations.",
          roles: ["ai_engineer"],
          skills: ["Python", "RAG"],
          country: null,
          engagement: [],
          website: null,
          projects: [],
          listed: true,
          version: null,
        },
      },
      { call: "POST /api/talent/mine/submit", body: null },
    ]);
  });

  test("a profile sent back says why, and a project needs a title before it is sent again", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "member", baseURL!);
    const changes = await answerDecisions(page, changesPath, 200, {});
    await page.goto(mine);

    await expect(page.getByText("Changes needed: Information is missing")).toBeVisible();
    await expect(page.getByText("Add a project.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();

    await expect(async () => {
      await page.getByRole("button", { name: "Add a project" }).click();
      await expect(page.getByLabel("Year")).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByRole("button", { name: "Send for review again" }).click();
    await expect(page.getByText("Give every project a title, or remove it.")).toBeVisible();
    await expect(page.getByText("Check the marked fields and try again.").first()).toBeVisible();
    expect(changes).toEqual([]);
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("textbox", { name: "Project 1" }).fill("Renewals assistant");
    await page.getByLabel("Year").fill("2026");
    await page.getByRole("button", { name: "Send for review again" }).click();

    await expect(page.getByText("Sent to GenAI Fund for review.")).toBeVisible();
    expect(changes.map((change) => change.call)).toEqual([
      "PUT /api/talent/mine",
      "POST /api/talent/mine/submit",
    ]);
    expect(changes[0].body).toMatchObject({
      projects: [{ title: "Renewals assistant", year: 2026, url: null, summary: null }],
      // The version the form loaded, so a save over another tab's change is refused.
      version: 4,
    });
  });

  test("an approved profile shows its messages, and a stale save is told by its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerDecisions(page, changesPath, 409, refusal("TALENT_CHANGED_MEANWHILE"));
    await page.goto(mine);

    await expect(page.getByText("Approved and listed in the directory")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open your public profile" })).toHaveAttribute(
      "href",
      "/talent/dat-phan",
    );
    const messages = page.getByRole("region", { name: "1 message" });
    await expect(
      messages.getByText("We are scoping a claims assistant and would like your view."),
    ).toBeVisible();
    await expect(
      messages.getByRole("link", { name: "Reply to ha.le@example.com" }),
    ).toHaveAttribute("href", "mailto:ha.le@example.com");
    await expectNoSeriousA11yViolations(page);

    const save = page.getByRole("button", { name: "Save changes" });
    await expect(save).toBeDisabled();
    await expect(async () => {
      await page.getByLabel("Headline").fill("Advises insurers on assistants");
      await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass();
    await save.click();

    await expect(
      page.getByText("This profile changed in another tab. Reload the page and try again."),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });
});
