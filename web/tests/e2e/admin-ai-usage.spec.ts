import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

test.describe("admin AI usage", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the usage", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/ai/usage", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/ai/usage"))?.status()).toBe(404);
    expect((await page.goto("/admin/ai/usage/calls"))?.status()).toBe(404);
  });

  test("the overview leads with what is failing, then the totals, the chart and where the calls went", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/usage");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI usage");
    // Next's route announcer is an alert too.
    const alert = page.getByRole("alert").filter({ hasText: "is failing" });
    await expect(alert).toContainText("Reading documents is failing on cx/gpt-6-luna");
    // The time carries its day and its zone: the alert covers 24 hours, so "14:24" alone could be yesterday's.
    await expect(alert).toContainText(
      /93 of its 412 calls to 9Router failed in the last 24 hours, the last on (Oct 9|9 Oct), 14:24 ICT\./,
    );
    await expect(alert).toContainText("The request was too large for the provider.");

    const totals = page.getByRole("definition");
    await expect(totals.filter({ hasText: "1,473 succeeded · 103 failed" })).toContainText("1,576");
    await expect(totals.filter({ hasText: "103 of 1,576 calls" })).toContainText("6.5%");
    await expect(totals.filter({ hasText: "2.17M in · 176K out" })).toContainText("2.35M");
    await expect(totals.filter({ hasText: "From the 319 calls with a known price" })).toContainText(
      "$0.14",
    );
    await expect(totals.filter({ hasText: "Model prices" })).toContainText("1,154");

    await expect(page.getByText("Calls by hour")).toBeVisible();
    await expect(page.getByText("Most at 15:00, 247 calls")).toBeVisible();

    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    const groups = isMobile ? page.getByRole("listitem") : page.getByRole("row");
    await expect(groups.filter({ hasText: "cx/gpt-6-luna" })).toContainText("22.6%");
    await expect(groups.filter({ hasText: "aihay" })).toContainText("61%");
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Provider", exact: true }).click();
    await expect(page).toHaveURL(/by=provider/);
    await expect(groups.filter({ hasText: "AI Hay" })).toContainText("957");

    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page).toHaveURL(/period=7d/);
    await expect(page.getByText("Calls by day")).toBeVisible();

    await page.getByRole("button", { name: "30 days" }).click();
    await expect(page.getByText("No calls in the last 30 days")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("the alert opens the failed calls in the log, which the filters narrow", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/ai/usage");
    await page.getByRole("link", { name: "See the failed calls" }).click();

    await expect(page).toHaveURL(/\/admin\/ai\/usage\/calls\?/);
    await expect(page).toHaveURL(/outcome=failed/);
    await expect(page).toHaveURL(/task=document_reading/);
    const calls = isMobile
      ? page.getByRole("listitem").filter({ hasText: "cx/gpt-6-luna" })
      : page.getByRole("row").filter({ hasText: "cx/gpt-6-luna" });
    await expect(calls).toHaveCount(2);
    // A failed call says what kind of failure it was, with the status where the provider gave one.
    await expect(calls.first()).toContainText("Request too large");
    await expect(calls.first()).toContainText("HTTP 413");
    await expect(calls.last()).toContainText("Failed");
    await expect(page.getByText("1–2 of 2 calls")).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("combobox", { name: "Outcome" }).click();
    await page.getByRole("option", { name: "All outcomes" }).click();
    await expect(page).not.toHaveURL(/outcome=/);

    await page.goto("/admin/ai/usage/calls");
    const every = isMobile ? page.getByRole("listitem") : page.getByRole("row");
    await expect(every.filter({ hasText: "aihay" })).toContainText("$0.0015");
    await expect(every.filter({ hasText: "cx/gpt-6.1-sol" })).toContainText("5,210 in · 512 out");
    await expect(every.filter({ hasText: "cx/gpt-6.1-sol" })).toContainText("Matching run");
    await expect(page.getByText("1–4 of 4 calls")).toBeVisible();
    // The tab back keeps the period.
    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute("href", /period=7d/);
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/admin\/ai\/usage\?period=7d/);
  });
});
