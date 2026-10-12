import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("Account", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in", async ({ page }) => {
    const visitor = await page.request.get("/account", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
  });

  test("a person changes their name and keeps their country and phone number", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/account");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
    // The address they sign in with is read, not typed; the name is theirs to change.
    await expect(page.getByText("dat.phan@example.com")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
    await expect(page.getByLabel("Name")).toHaveValue("Đạt Phan");
    await expectNoSeriousA11yViolations(page);

    const saved: unknown[] = [];
    await page.route("**/api/identity/me/contact", async (route) => {
      expect(route.request().method()).toBe("PUT");
      saved.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, json: {} });
    });

    await page.getByLabel("Phone number").fill("call me");
    await expect(page.getByText("Enter a phone number with its country code")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    expect(saved).toHaveLength(0);

    await page.getByLabel("Name").fill(" ");
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    expect(saved).toHaveLength(0);

    await page.getByLabel("Name").fill("Phan Tiến Đạt");
    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("Phone number").fill("+84 912 345 678");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your account is saved.")).toBeVisible();
    expect(saved).toEqual([{ name: "Phan Tiến Đạt", country: "VN", phone: "+84 912 345 678" }]);
  });
});
