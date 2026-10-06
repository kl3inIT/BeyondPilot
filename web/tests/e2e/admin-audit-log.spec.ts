import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

/** The events shown, each by its sentence, whichever layout the viewport has. */
function shownEvents(page: Page) {
  return page.locator('[data-slot="audit-activity"]:visible');
}

const lastWeek = [
  "Disabled the account of Quang Vũ",
  "Gave the operator role to Minh Trần",
  "Gave the operator role to Đạt Phan",
  "Withdrew the operator role from Arif Hidayat",
];

test.describe("admin audit log", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the log", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/audit-log", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Faudit-log");

    await signInAs(context, "unnamed", baseURL!);
    const answer = await page.goto("/admin/audit-log");
    expect(answer?.status()).toBe(404);
  });

  test("an operator reads the last seven days, newest first, each event as one sentence", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit log");
    await expect(shownEvents(page)).toHaveText(lastWeek);
    // An event the server configuration made names no person.
    await expect(page.locator('[data-slot="person"]:visible').nth(2)).toContainText("System");
    // Four events fit one page, so no paging is offered.
    await expect(page.getByRole("navigation", { name: "Pages of the audit log" })).toHaveCount(0);
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);
  });

  test("the short time carries the full date and time", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "a phone has no pointer to hover with");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log");

    const time = page.getByRole("table").locator("time").first();
    const tooltip = page.locator('[data-slot="tooltip-content"]');
    // A hover before the page has hydrated finds no handler, so it is repeated until the tooltip shows.
    await expect(async () => {
      await page.mouse.move(0, 0);
      await time.hover();
      await expect(tooltip).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(tooltip).toHaveText(/^\w+, \w+ \d{1,2}, \d{4} at \d{2}:\d{2}:\d{2}$/);
  });

  test("period, action and search are the address, and the server answers them", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log");

    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "All time" }).click();
    await expect(page).toHaveURL(/period=all/);
    await expect(shownEvents(page)).toHaveText([...lastWeek, "Enabled the account of Siti Rahma"]);

    await page.getByRole("combobox", { name: "Action" }).click();
    await page.getByRole("option", { name: "Gave the operator role" }).click();
    await expect(page).toHaveURL(/action=operator\.grant/);
    await expect(shownEvents(page)).toHaveText([
      "Gave the operator role to Minh Trần",
      "Gave the operator role to Đạt Phan",
    ]);

    await page.getByRole("searchbox", { name: "Search people or accounts" }).fill("minh");
    await expect(page).toHaveURL(/[?&]q=minh/);
    await expect(shownEvents(page)).toHaveText(["Gave the operator role to Minh Trần"]);

    // A link to this address shows the same events.
    await page.reload();
    await expect(shownEvents(page)).toHaveText(["Gave the operator role to Minh Trần"]);
    await expect(page.getByRole("combobox", { name: "Action" })).toContainText(
      "Gave the operator role",
    );
  });

  test("a log longer than a page is walked towards the past and back, keeping the search", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log?period=all&q=example");

    const paging = page.getByRole("navigation", { name: "Pages of the audit log" });
    await expect(shownEvents(page)).toHaveText(lastWeek.slice(0, 2));
    await expect(paging.getByRole("link", { name: "Go to newer events" })).toHaveCount(0);

    await paging.getByRole("link", { name: "Go to older events" }).click();

    await expect(page).toHaveURL(/period=all&q=example&before=/);
    await expect(shownEvents(page)).toHaveText([
      "Withdrew the operator role from Arif Hidayat",
      "Enabled the account of Siti Rahma",
    ]);
    await expect(paging.getByRole("link", { name: "Go to older events" })).toHaveCount(0);

    await paging.getByRole("link", { name: "Go to newer events" }).click();

    await expect(page).toHaveURL(/period=all&q=example&after=/);
    await expect(shownEvents(page)).toHaveText(lastWeek.slice(0, 2));
  });

  test("a cursor that is not one leads to the newest events", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log?action=operator.grant&before=yesterday");

    await expect(page).toHaveURL("/admin/audit-log?action=operator.grant");
    await expect(shownEvents(page)).toHaveCount(2);
  });

  test("a search that finds nothing says so and offers the way back", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/audit-log?q=nobody");

    // The table and the stacked rows both hold this state; the viewport shows one of them.
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText("No event matches");
    await page.getByRole("link", { name: "Clear search and filters" }).click();

    await expect(page).toHaveURL("/admin/audit-log");
    await expect(shownEvents(page)).toHaveCount(4);
  });

  test("the sidebar leads to the audit log and marks it as the current page", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "on a phone the sidebar is a sheet; admin.spec.ts covers opening it");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");

    const navigation = page.getByRole("navigation", { name: "Admin navigation" });
    await navigation.getByRole("link", { name: "Audit log" }).click();

    await expect(page).toHaveURL("/admin/audit-log");
    await expect(navigation.getByRole("link", { name: "Audit log" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
