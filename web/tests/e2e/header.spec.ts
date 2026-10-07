import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerSignOut, signInAs } from "./session";

test.describe("header", () => {
  test.use({ locale: "en-US" });

  test("a visitor is offered the ways in", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(header.getByRole("button", { name: /Account menu/ })).toHaveCount(0);
  });

  test("a signed-in person sees who they are and signs out", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    const signOuts = await answerSignOut(page, 204);
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Get started" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveCount(0);

    const account = header.getByRole("button", { name: "Account menu for Đạt Phan" });
    await expect(account).toHaveText("ĐP");
    await account.click();

    const menu = page.getByRole("menu");
    await expect(menu.getByText("Đạt Phan")).toBeVisible();
    await expect(menu.getByText("dat.phan@example.com")).toBeVisible();
    await expect(menu.getByText("Operator")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(header.getByRole("link", { name: "Get started" })).toBeVisible();
    expect(signOuts).toEqual(["POST"]);
  });

  test("an account without a name shows its address", async ({ page, context, baseURL }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/");

    const account = page
      .getByRole("banner")
      .getByRole("button", { name: "Account menu for an.tran@example.com" });
    await expect(account).toHaveText("A");
    await account.click();

    const menu = page.getByRole("menu");
    await expect(menu.getByText("an.tran@example.com")).toBeVisible();
    await expect(menu.getByText("Operator")).toHaveCount(0);
  });

  test("a sign-out that fails says so and keeps the person signed in", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerSignOut(page, 500);
    await page.goto("/");

    await page
      .getByRole("banner")
      .getByRole("button", { name: /Account menu/ })
      .click();
    const menu = page.getByRole("menu");
    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(menu.getByRole("alert")).toHaveText("We could not sign you out. Try again.");
    await expect(menu.getByText("dat.phan@example.com")).toBeVisible();
  });

  test("the phone menu drops the ways in for a signed-in person", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(!isMobile, "the full-screen menu exists below 768px only");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "Events & Programs" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Get started" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  });
});
