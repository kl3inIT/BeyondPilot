import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const minh = "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a04";

/** Answers the commands the browser sends about one account; returns the requests it saw. */
async function answerCommands(page: Page, status: number, problem?: object) {
  const requests: string[] = [];
  await page.route("**/api/identity/accounts/*/*", async (route) => {
    const request = route.request();
    requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    await route.fulfill(
      problem
        ? { status, contentType: "application/problem+json", body: JSON.stringify(problem) }
        : { status },
    );
  });
  return requests;
}

/** The accounts shown, by the name each row leads with, whichever layout the viewport has. */
function shownAccounts(page: Page) {
  return page.locator('[data-slot="person"]:visible >> span.font-medium');
}

test.describe("admin accounts", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the list", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/accounts", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Faccounts");

    await signInAs(context, "unnamed", baseURL!);
    const answer = await page.goto("/admin/accounts");
    expect(answer?.status()).toBe(404);
  });

  test("an operator sees every account with its role and status, and no actions on their own", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/accounts");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accounts");
    await expect(shownAccounts(page)).toHaveText([
      "Đạt Phan",
      "Hà Lê",
      "Minh Trần",
      "an.tran@example.com",
      "Quang Vũ",
    ]);
    await expect(page.getByText("5 accounts")).toBeVisible();
    await expect(
      page.getByText("Disabled", { exact: true }).and(page.locator(":visible")),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Actions for Đạt Phan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Actions for Minh Trần" })).toBeVisible();
    // A table from 768px, stacked rows below it.
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);
  });

  test("search and filters are the address, and the server answers them", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/accounts?page=1");

    await page.getByRole("searchbox", { name: "Search by name or email" }).fill("example.com");
    await expect(page).toHaveURL(/[?&]q=example\.com/);
    await expect(shownAccounts(page)).toHaveText(["Đạt Phan", "Hà Lê", "an.tran@example.com"]);

    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "Operator" }).click();
    await expect(page).toHaveURL(/role=operator/);
    await expect(shownAccounts(page)).toHaveText(["Đạt Phan", "Hà Lê"]);

    // A link to this address shows the same list.
    await page.reload();
    await expect(shownAccounts(page)).toHaveText(["Đạt Phan", "Hà Lê"]);
    await expect(page.getByRole("searchbox", { name: "Search by name or email" })).toHaveValue(
      "example.com",
    );
  });

  test("a list longer than a page is walked page by page, keeping the search", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/accounts?q=example");

    const paging = page.getByRole("navigation", { name: "Pages of accounts" });
    await expect(shownAccounts(page)).toHaveText(["Đạt Phan", "Hà Lê"]);
    await expect(page.getByText("5 accounts")).toBeVisible();
    await expect(paging.getByRole("link", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(paging.getByRole("link", { name: "Go to the previous page" })).toHaveCount(0);

    await paging.getByRole("link", { name: "Go to the next page" }).click();

    await expect(page).toHaveURL("/admin/accounts?q=example&page=2");
    await expect(shownAccounts(page)).toHaveText(["Minh Trần", "an.tran@example.com"]);

    await paging.getByRole("link", { name: "Page 3" }).click();

    await expect(shownAccounts(page)).toHaveText(["Quang Vũ"]);
    await expect(paging.getByRole("link", { name: "Go to the next page" })).toHaveCount(0);
  });

  test("a list that fits one page offers no paging", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/accounts");

    await expect(page.getByText("5 accounts")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Pages of accounts" })).toHaveCount(0);
  });

  test("a search that finds nothing says so and offers the way back", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/accounts?q=nobody&status=disabled");

    // The table and the stacked rows both hold this state; the viewport shows one of them.
    await expect(page.locator('[data-slot="empty-title"]:visible')).toHaveText(
      "No account matches",
    );
    await page.getByRole("link", { name: "Clear search and filters" }).click();

    await expect(page).toHaveURL("/admin/accounts");
    await expect(shownAccounts(page)).toHaveCount(5);
  });

  test("disabling asks first, names the person, and says when it is done", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const commands = await answerCommands(page, 204);
    await page.goto("/admin/accounts");

    await page.getByRole("button", { name: "Actions for Minh Trần" }).click();
    await page.getByRole("menuitem", { name: "Disable account…" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Disable this account?");
    await expect(dialog.getByText("minh.tran@pocketpolicy.example")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    expect(commands).toEqual([]);
    await expectNoSeriousA11yViolations(page);

    await dialog.getByRole("button", { name: "Disable account" }).click();

    await expect(page.getByText("Minh Trần can no longer sign in.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(commands).toEqual([`POST /api/identity/accounts/${minh}/disable`]);
  });

  test("a refusal is told in the words of its code", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    await answerCommands(page, 409, {
      status: 409,
      title: "Conflict",
      code: "IDENTITY_OPERATOR_CONFIGURED",
      detail: "text of the backend that must not be shown",
      requestId: "0b0f6a52-1d8e-4c0e-9d0a-5a7c1e2f3a44",
    });
    await page.goto("/admin/accounts");

    await page.getByRole("button", { name: "Actions for Hà Lê" }).click();
    await page.getByRole("menuitem", { name: "Withdraw operator role…" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Withdraw role" }).click();

    await expect(
      page.getByText(
        "This operator is set in the server configuration, so the role cannot be withdrawn here.",
      ),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
  });

  test("the sidebar leads to the accounts and marks them as the current page", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "on a phone the sidebar is a sheet; admin.spec.ts covers opening it");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");

    const navigation = page.getByRole("navigation", { name: "Admin navigation" });
    await navigation.getByRole("link", { name: "Accounts" }).click();

    await expect(page).toHaveURL("/admin/accounts");
    await expect(navigation.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
