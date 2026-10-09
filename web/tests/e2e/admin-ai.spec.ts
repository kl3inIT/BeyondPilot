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

  test("the chat tab comes first: the model of each task, the connections and what can be added", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/providers");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI providers");
    await expect(page.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Embedding" })).not.toHaveAttribute("aria-current");

    // The task shows its model and the level it reasons at.
    const tasks = page.getByRole("region", { name: "Models by task" });
    const picker = tasks.getByRole("combobox", { name: "Model for Matching" });
    await expect(picker).toContainText("claude-sonnet-4-5");
    await expect(picker).toContainText("Medium");

    // A connection says where it is and that it is in use; its key is never shown. The models are a
    // table with prices from 768px, and name and context below it.
    const connections = page.getByRole("region", { name: "Available connections" });
    await expect(connections.getByRole("heading", { name: "Claude" })).toBeVisible();
    await expect(connections.getByText("In use")).toBeVisible();
    await expect(connections.getByText("http://10.0.0.12:20128/v1")).toBeVisible();
    const models = connections.getByRole("table", { name: "Models enabled on Claude" });
    await expect(models.getByRole("row")).toHaveCount(4);
    await expect(models.getByRole("columnheader", { name: "In / 1M" })).toHaveCount(
      isMobile ? 0 : 1,
    );
    await expect(
      connections
        .getByRole("button", { name: isMobile ? "Actions for Claude" : "Test connection" })
        .first(),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // The selector groups the models by provider and ends in the reasoning row.
    await picker.click();
    await expect(page.getByRole("option", { name: /gpt-5-mini/ })).toBeVisible();
    await expect(
      page.getByRole("radiogroup", { name: "Reasoning" }).getByRole("radio"),
    ).toHaveCount(4);
    await page.keyboard.press("Escape");

    // A gateway takes any address, typed by the operator, and a key typed blind.
    await page.getByRole("button", { name: "Connect OpenAI-Compatible" }).click();
    const dialog = page.getByRole("dialog", { name: "Connect OpenAI-Compatible" });
    await expect(dialog.getByLabel("Endpoint URL")).toHaveValue("");
    await expect(dialog.getByLabel("Endpoint URL")).toBeEditable();
    await expect(dialog.getByLabel("API key")).toHaveAttribute("type", "password");
    await expect(dialog.getByRole("button", { name: "List models" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Save provider" })).toBeDisabled();
    await expectNoSeriousA11yViolations(page);
  });

  test("an operator sees the model in use, the provider connected and the ones that can be", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/providers?tab=embedding");

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

  test("the OCR tab shows what reads documents, the services connected and the ones that can be", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/providers?tab=ocr");

    await expect(page.getByRole("link", { name: "OCR" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current");

    // The reader is the OCR service that was chosen; a model can take its place.
    const reader = page.getByRole("region", { name: "Reader" });
    await expect(reader.getByRole("heading", { name: "Reading documents" })).toBeVisible();
    const kind = reader.getByRole("group", { name: "Read with" });
    await expect(kind.getByRole("button", { name: "OCR service" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(reader.getByLabel("OCR service for Reading documents")).toHaveValue(
      "0c700000-0000-4000-8000-000000000001",
    );
    await kind.getByRole("button", { name: "Model" }).click();
    await expect(
      reader.getByRole("combobox", { name: "Model for Reading documents" }),
    ).toBeVisible();
    await expect(reader.getByRole("link", { name: "Chat tab" })).toBeVisible();

    // A connection says where it is and that it reads documents; its key is never shown.
    const connections = page.getByRole("region", { name: "Available connections" });
    await expect(connections.getByRole("heading", { name: "AI Hay" })).toBeVisible();
    await expect(connections.getByText("Reads documents")).toBeVisible();
    await expect(connections.getByText("https://api.ai-hay.vn")).toBeVisible();
    await expect(
      connections.getByRole("button", {
        name: isMobile ? "Actions for AI Hay" : "Test connection",
      }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // A service is connected at its own address, with a key typed blind.
    await page.getByRole("button", { name: "Connect AI Hay" }).click();
    const dialog = page.getByRole("dialog", { name: "Connect AI Hay" });
    await expect(dialog.getByLabel("Endpoint URL")).toHaveValue("https://api.ai-hay.vn");
    await expect(dialog.getByLabel("Price per 1,000 pages (USD)")).toHaveValue("1.5");
    await expect(dialog.getByLabel("API key")).toHaveAttribute("type", "password");
    await expect(dialog.getByRole("button", { name: "Test connection" })).toBeDisabled();
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
