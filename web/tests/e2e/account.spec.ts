import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("Account", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in", async ({ page }) => {
    const visitor = await page.request.get("/account", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
  });

  test("a person keeps their country and phone number on the account", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/account");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
    await expect(page.getByLabel("Email")).toBeDisabled();
    await expectNoSeriousA11yViolations(page);

    const saved: unknown[] = [];
    await page.route("**/api/identity/me/contact", async (route) => {
      expect(route.request().method()).toBe("PUT");
      saved.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, json: {} });
    });

    await page.getByLabel("Phone number").fill("call me");
    await expect(page.getByText("Enter a phone number with its country code")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    expect(saved).toHaveLength(0);

    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone number").fill("+84 912 345 678");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Your account is saved.")).toBeVisible();
    expect(saved).toEqual([{ country: "VN", phone: "+84 912 345 678" }]);
  });
});
