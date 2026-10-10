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

  test("an operator finds the operators' server, switches a tool and trusts a host", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/mcp");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("MCP");
    await expect(page.getByLabel("Server address").first()).toHaveValue(
      "https://beyondpilot.test/mcp/operator",
    );
    await page.getByRole("tab", { name: "Other apps" }).click();
    // What only an app without a client name needs is behind a click.
    const clientHelp = page.getByRole("button", {
      name: "How an app without a client name signs in",
    });
    await expect(page.getByText(/signs in as mcp-local/)).toHaveCount(0);
    await clientHelp.click();
    await expect(page.getByText(/signs in as mcp-local/)).toBeVisible();
    await clientHelp.click();
    await expect(page.getByText(/signs in as mcp-local/)).toHaveCount(0);
    const trusted = page.getByRole("region", { name: "Trusted app hosts" });
    await expect(trusted.getByText("zed.dev")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const added: unknown[] = [];
    await page.route("**/api/identity/admin/app-hosts/add", async (route) => {
      added.push(route.request().postDataJSON());
      await route.fulfill({ status: 204 });
    });
    await trusted.getByRole("textbox", { name: "Add host" }).fill("app.example.com");
    await trusted.getByRole("button", { name: "Add host" }).click();
    await expect.poll(() => added).toEqual([{ host: "app.example.com" }]);

    await page.getByRole("link", { name: /Tools/ }).click();
    await expect(page).toHaveURL(/\/admin\/ai\/mcp\/tools$/);
    const switched: unknown[] = [];
    await page.route("**/api/mcp/admin/tools/**", async (route) => {
      switched.push([new URL(route.request().url()).pathname, route.request().postDataJSON()]);
      await route.fulfill({ status: 204 });
    });
    const user = page.getByRole("region", { name: "User server" });
    await expect(user.getByRole("switch", { name: "Turn fetch on or off" })).not.toBeChecked();
    await user.getByRole("switch", { name: "Turn fetch on or off" }).click();
    await expect
      .poll(() => switched)
      .toEqual([["/api/mcp/admin/tools/user/fetch", { enabled: true }]]);
    await expectNoSeriousA11yViolations(page);
  });

  test("someone who is not an operator is not shown the MCP admin", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const response = await page.goto("/admin/ai/mcp");
    expect(response?.status()).toBe(404);
  });

  test("an operator sees every connected app and revokes one, and reads the calls by filter", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/mcp/apps");

    const apps = page.getByRole("list", { name: "Connected apps" });
    await expect(apps.getByText("ChatGPT · Minh Tran")).toBeVisible();
    await expect(apps.getByText("Claude Code · Đạt Phan")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const revoked: string[] = [];
    await page.route("**/api/identity/admin/apps/*/*/revoke", async (route) => {
      revoked.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 204 });
    });
    await apps.getByRole("button", { name: "Revoke ChatGPT of Minh Tran" }).click();
    await page
      .getByRole("alertdialog", { name: "Revoke ChatGPT of Minh Tran?" })
      .getByRole("button", { name: "Revoke" })
      .click();
    await expect(
      page.getByText("ChatGPT of Minh Tran can no longer use BeyondPilot."),
    ).toBeVisible();
    expect(revoked).toEqual([
      "/api/identity/admin/apps/5b1f2c3d-0000-4000-8000-000000000001/0d6c1b9e-7f2a-3c41-9a8e-111111111111/revoke",
    ]);

    await page.goto("/admin/ai/mcp/activity");
    const calls = isMobile ? page.getByRole("listitem") : page.getByRole("row");
    await expect(calls.filter({ hasText: "Minh Tran" })).toContainText("Refused");
    await expect(calls.filter({ hasText: "Đạt Phan" })).toContainText("Succeeded");
    await expect(page.getByText("2 calls")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("combobox", { name: "Outcome" }).click();
    await page.getByRole("option", { name: "Refused" }).click();
    await expect(page).toHaveURL(/outcome=refused/);
  });
});
