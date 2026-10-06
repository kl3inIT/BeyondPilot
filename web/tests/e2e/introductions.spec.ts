import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const askPath = "**/api/introduction/introductions";
const answerPath = "**/api/introduction/mine/received/*/*";
const waiting = "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c21";

test.describe("asking for an introduction", () => {
  test.use({ locale: "en-US" });

  test("a visitor signs in first, and comes back to the solution to ask", async ({ page }) => {
    await page.goto("/solutions/clinic-triage");

    await expect(page.getByRole("link", { name: "Request an introduction" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fsolutions%2Fclinic-triage",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("on a phone the way to ask stays in a bar at the foot of the screen", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The bar is for phones; wider screens keep the action beside the page.");
    await page.goto("/solutions/clinic-triage");

    const bar = page.locator("div.fixed.bottom-0");
    await expect(bar.getByText("Clinic Triage")).toBeVisible();
    await expect(bar.getByText("By Lumen Health")).toBeVisible();
    await expect(bar.getByRole("link", { name: "Request an introduction" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fsolutions%2Fclinic-triage",
    );
  });

  test("a person without an organization is told to set one up", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/solutions/clinic-triage");

    await page.getByRole("button", { name: "Request an introduction" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Join an organization first" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Set up your organization" })).toHaveAttribute(
      "href",
      "/workspace/organization",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("an organization that is not approved yet is told to wait", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "waiting", baseURL!);
    const sent = await answerDecisions(page, askPath, 204);
    await page.goto("/solutions/clinic-triage");

    await page.getByRole("button", { name: "Request an introduction" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Your organization is not approved yet" }),
    ).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    expect(sent).toEqual([]);
  });

  test("an organization asks, naming itself, and a message is needed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const sent = await answerDecisions(page, askPath, 204);
    await page.goto("/solutions/clinic-triage");

    await page.getByRole("button", { name: "Request an introduction" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Request an introduction to Lumen Health" }),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        "Introductions go through GenAI Fund. Neither email address is shown until Lumen Health replies.",
      ),
    ).toBeVisible();
    await expect(dialog.getByText("Pocket Policy", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog.getByText("Write a message first.")).toBeVisible();
    expect(sent).toEqual([]);
    // The pointer rests on the button that was pressed; its hover colour is not what is checked.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await dialog
      .getByRole("textbox", { name: "What do you need?" })
      .fill("Triage for our clinics.");
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(
      dialog.getByRole("heading", { name: "Your request is with Lumen Health" }),
    ).toBeVisible();
    expect(sent).toEqual([
      {
        call: "POST /api/introduction/introductions",
        body: { solutionSlug: "clinic-triage", message: "Triage for our clinics." },
      },
    ]);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
  });

  test("a second request about the same solution is refused in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await answerDecisions(page, askPath, 409, refusal("INTRODUCTION_ALREADY_PENDING"));
    await page.goto("/solutions/clinic-triage");

    await page.getByRole("button", { name: "Request an introduction" }).click();
    await page.getByRole("textbox", { name: "What do you need?" }).fill("Again.");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(
      page.getByText(
        "You already asked for an introduction to this solution. Wait for the answer.",
      ),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    // The message is kept, so it is not written twice.
    await expect(page.getByRole("textbox", { name: "What do you need?" })).toHaveValue("Again.");
  });

  test("the organization that offers a solution has no one to ask but itself", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto("/solutions/policy-chat");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Policy Chat");
    await expect(page.getByRole("button", { name: "Request an introduction" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Request an introduction" })).toHaveCount(0);
  });
});

test.describe("workspace introductions", () => {
  test.use({ locale: "en-US" });

  test("an owner reads the requests and what became of each", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto("/workspace/organization/introductions");

    await expect(page.getByRole("heading", { level: 2, name: "Introductions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Introductions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText("1 waiting")).toBeVisible();
    await expect(page.getByText("Hà Lê · Lumen Health")).toBeVisible();
    await expect(page.getByText("We want a renewals assistant for our clinics.")).toBeVisible();
    await expect(page.getByText("Someone at Mekong Life")).toBeVisible();
    // An address is shown only on a request that was replied to.
    await expect(
      page.getByText("Introduced. Write to them at claims@mekong.example."),
    ).toBeVisible();
    await expect(page.getByText("claims@mekong.example")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Reply" })).toHaveCount(1);
    await expectNoSeriousA11yViolations(page);
  });

  test("a reply is sent as it is, and says that both sides were told", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const answered = await answerDecisions(page, answerPath, 204);
    await page.goto("/workspace/organization/introductions");

    await page.getByRole("button", { name: "Reply" }).click();

    await expect(
      page.getByText("Introduced. Both of you got an email with the other's address."),
    ).toBeVisible();
    expect(answered).toEqual([
      { call: `POST /api/introduction/mine/received/${waiting}/reply`, body: null },
    ]);
  });

  test("a decline asks first, and shares no address", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    const answered = await answerDecisions(page, answerPath, 204);
    await page.goto("/workspace/organization/introductions");

    // The page may not have hydrated yet, so the first press can find nothing to open.
    await expect(async () => {
      await page.getByRole("button", { name: "Decline" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 1000 });
    }).toPass();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Decline the request about Policy Chat?");
    expect(answered).toEqual([]);
    await expectNoSeriousA11yViolations(page);

    await dialog.getByRole("button", { name: "Decline" }).click();

    await expect(page.getByText("Request declined.")).toBeVisible();
    expect(answered).toEqual([
      { call: `POST /api/introduction/mine/received/${waiting}/decline`, body: null },
    ]);
  });

  test("a refused answer is shown in the words of its code", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    await answerDecisions(page, answerPath, 409, refusal("INTRODUCTION_NOT_PENDING"));
    await page.goto("/workspace/organization/introductions");

    await page.getByRole("button", { name: "Reply" }).click();

    await expect(page.getByText("This request was already answered.")).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });

  test("a member reads the requests and is told who answers them", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "member", baseURL!);
    await page.goto("/workspace/organization/introductions");

    await expect(page.getByText("Hà Lê · Lumen Health")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reply" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Decline" })).toHaveCount(0);
    await expect(
      page.getByText("Only an owner of the organization answers a request."),
    ).toBeVisible();
  });

  test("a person without an organization is sent to its first page", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/workspace/organization/introductions");

    await expect(page).not.toHaveURL(/introductions/);
  });
});
