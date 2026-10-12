import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const answerPath = "**/api/introduction/mine/received/*/*";
const waiting = "e19ebcda-8b86-4cd9-9cd3-8f1b4b4d5c21";

test.describe("workspace introductions", () => {
  test.use({ locale: "en-US" });

  test("an owner reads the requests and what became of each", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto("/workspace/organization/introductions");

    // The tab stands inside the site's header, as the other tabs of the organization do.
    await expect(page.getByRole("banner")).toBeVisible();
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

    // A reply asks nothing first, so what it shares is said beside the button.
    await expect(
      page.getByText("Replying sends you both an email with the other's address."),
    ).toBeVisible();
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
