import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("admin AI", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the providers or the index", async ({
    page,
    context,
    baseURL,
  }) => {
    const visitor = await page.request.get("/admin/ai/providers", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/ai/providers"))?.status()).toBe(404);
    expect((await page.goto("/admin/ai/search-index"))?.status()).toBe(404);
  });

  test("an operator sees the model in use, the provider connected and the ones that can be", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/providers");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI providers");
    await expect(page.getByRole("link", { name: "Embedding" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const model = page.getByRole("region", { name: "Embedding model" });
    await expect(model.getByText("openai/text-embedding-3-large")).toBeVisible();
    await expect(model.getByText("82 of 86")).toBeVisible();
    await expect(model.getByText("Search · 86 items")).toBeVisible();

    // The provider in use says so and cannot be deleted; its key is never shown.
    const connected = page.getByRole("region", { name: "Connected providers" });
    await expect(connected.getByText("Key saved")).toBeVisible();
    await expect(connected.getByRole("button", { name: "Delete" })).toBeDisabled();
    await expect(connected.getByText(/change the model to another provider/i)).toBeVisible();

    // Connecting takes the vendor's own address, which cannot be changed, and a key typed blind.
    await page.getByRole("button", { name: "Connect OpenAI" }).click();
    const dialog = page.getByRole("dialog", { name: "Connect OpenAI" });
    await expect(dialog.getByLabel("Base URL")).toHaveValue("https://api.openai.com/v1");
    await expect(dialog.getByLabel("Base URL")).toHaveAttribute("readonly", "");
    await expect(dialog.getByLabel("API key")).toHaveAttribute("type", "password");
    await expect(dialog.getByRole("button", { name: "Save provider" })).toBeDisabled();
    await expectNoSeriousA11yViolations(page);
  });

  test("the search index shows semantic search, each kind and what the provider refused", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/search-index");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search index");
    await expect(page.getByText("Semantic search is on")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Semantic search" })).toBeChecked();
    await expect(page.getByText("Lan Pham").filter({ visible: true })).toBeVisible();
    await expect(
      page.getByText("The provider refused the text (400 Bad request).").filter({ visible: true }),
    ).toBeVisible();
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 2);
    await expectNoSeriousA11yViolations(page);
  });
});
