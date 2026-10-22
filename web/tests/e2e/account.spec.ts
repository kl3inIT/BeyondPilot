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

  test("a person turns a consent purpose off at once, can undo it, and is asked before withdrawing the platform", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Privacy and consent" })).toBeVisible();

    const recorded: { ai: boolean; platform: boolean; source: string }[] = [];
    await page.route("**/api/identity/consent", async (route) => {
      const body = route.request().postDataJSON();
      recorded.push(body);
      await route.fulfill({
        status: 200,
        json: {
          version: 1,
          locale: "en",
          text: "",
          needed: !body.platform,
          purposes: ["platform", "partners", "ai", "updates"].map((key) => ({
            key,
            requiredFor: key === "platform" ? "platform" : key === "partners" ? "apply" : "none",
            granted: body[key],
            answeredAt: "2026-10-22T03:00:00Z",
          })),
        },
      });
    });

    const ai = page.getByRole("switch", { name: "AI suggestions and evaluation" });
    await expect(ai).toBeChecked();
    await ai.click();
    await expect(page.getByText("AI suggestions and evaluation turned off.")).toBeVisible();
    await expect(ai).not.toBeChecked();
    expect(recorded.at(-1)).toMatchObject({ ai: false, platform: true, source: "settings" });

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(ai).toBeChecked();
    expect(recorded.at(-1)).toMatchObject({ ai: true, source: "undo" });

    await page.getByRole("switch", { name: "Use the platform" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "Withdraw your consent to use the platform?",
    );
    await page.getByRole("button", { name: "Keep my account" }).click();
    expect(recorded.every((choice) => choice.platform)).toBe(true);
  });
});
