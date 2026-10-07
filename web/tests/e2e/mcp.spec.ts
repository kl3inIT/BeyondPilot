import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("MCP", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in", async ({ page }) => {
    const visitor = await page.request.get("/account/mcp", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
  });

  test("a person finds the server's address, the steps and their apps, and revokes one", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/account/mcp");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("MCP");
    await expect(page.getByLabel("Server address")).toHaveValue(/\/mcp$/);
    await expect(page.getByText("Settings › Apps and connectors › Create")).toBeVisible();
    await page.getByRole("tab", { name: "Codex" }).click();
    await expect(page.getByText(/codex mcp add beyondpilot --url .*\/mcp/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("tab", { name: /Connected apps/ }).click();
    const apps = page.getByRole("list");
    await expect(apps.getByText("ChatGPT")).toBeVisible();
    await expect(apps.getByText("Claude")).toBeVisible();

    const revoked: string[] = [];
    await page.route("**/api/identity/apps/*/revoke", async (route) => {
      revoked.push(route.request().url());
      await route.fulfill({ status: 204 });
    });
    await apps.getByRole("button", { name: "Revoke" }).first().click();
    const dialog = page.getByRole("alertdialog", { name: "Revoke ChatGPT?" });
    await dialog.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("ChatGPT can no longer use BeyondPilot.")).toBeVisible();
    expect(revoked).toHaveLength(1);
    expect(revoked[0]).toContain("0d6c1b9e-7f2a-3c41-9a8e-111111111111");
  });

  test("with no app connected, the list leads back to connecting one", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/account/mcp");

    await page.getByRole("tab", { name: "Connected apps" }).click();
    await expect(page.getByText("No app is connected")).toBeVisible();
    await page.getByRole("button", { name: "Connect an app" }).click();
    await expect(page.getByLabel("Server address")).toBeVisible();
  });

  test("the account menu leads to it", async ({ page, context, baseURL }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/");
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: "MCP" }).click();
    await expect(page).toHaveURL(/\/account\/mcp$/);
  });
});
