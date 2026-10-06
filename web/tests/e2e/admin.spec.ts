import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerSignOut, signInAs } from "./session";

/** The toggle in the bar above the page; the sidebar's own edge carries a second one. */
function sidebarToggle(page: Page) {
  return page.getByRole("main").getByRole("button", { name: "Toggle sidebar" });
}

test.describe("admin", () => {
  test.use({ locale: "en-US" });

  for (const { path, signIn } of [
    { path: "/admin", signIn: "/sign-in?returnTo=%2Fadmin" },
    { path: "/vi/admin", signIn: "/vi/sign-in?returnTo=%2Fvi%2Fadmin" },
  ]) {
    test(`a visitor to ${path} is sent to sign in and back`, async ({ page }) => {
      // The answer itself redirects: nothing of the page is sent to someone who is not signed in.
      const answer = await page.request.get(path, { maxRedirects: 0 });
      expect(answer.status()).toBe(307);
      expect(answer.headers()["location"]).toBe(signIn);

      await page.goto(path);
      await expect(page).toHaveURL(signIn);
    });
  }

  test("an account that is not an operator gets the page any unknown address gets", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);

    const answer = await page.goto("/admin");
    expect(answer?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    const refused = await page.locator("body").innerText();

    await page.goto("/no-such-page");
    await expect(page.locator("body")).toHaveText(refused, { useInnerText: true });
  });

  test("an operator opens the admin area, which search engines are told to skip", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);

    const answer = await page.goto("/admin");
    expect(answer?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoSeriousA11yViolations(page);
  });

  test("admin home counts what waits for a decision, each count a way into its queue", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");

    // An organization waits when it is new, and when someone claims one nobody owns.
    await expect(page.getByText("6 records wait for a decision.")).toBeVisible();
    for (const [queue, count, href] of [
      ["Organizations to review", 2, "/admin/organizations?status=in_review"],
      ["Solutions to review", 2, "/admin/solutions?status=submitted"],
      ["Talent profiles to review", 2, "/admin/talent?status=submitted"],
    ] as const) {
      const link = page.getByRole("main").getByRole("link", { name: queue });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toContainText(String(count));
    }

    await page.getByRole("main").getByRole("link", { name: "Solutions to review" }).click();
    await expect(page).toHaveURL("/admin/solutions?status=submitted");
    await expect(page.getByText("2 solutions")).toBeVisible();
  });

  test("the sidebar marks the current page, and collapsed to icons it stays so and keeps its names", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "below 768px the sidebar is a sheet, not a column that collapses");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");

    const home = page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "Home" });
    await expect(home).toHaveAttribute("aria-current", "page");
    // Home leads; what GenAI Fund reviews and the system's own records each have their group.
    const navigation = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(navigation.getByRole("list", { name: "Review" }).getByRole("link")).toHaveText([
      "Programs",
      "Use cases",
      "AI solutions",
      "AI talent",
      "Organisations",
      "Introductions",
    ]);
    await expect(navigation.getByRole("list", { name: "System" }).getByRole("link")).toHaveText([
      "Accounts",
      "Audit log",
      "Email",
    ]);

    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await sidebarToggle(page).click();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    // The choice is read on the server, so the page comes back collapsed rather than snapping shut.
    await page.reload();
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await home.hover();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText("Home");
    await expectNoSeriousA11yViolations(page);
  });

  test("on a phone the sidebar opens over the page", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(!isMobile, "the sheet exists below 768px only");
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");

    await sidebarToggle(page).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: "Home" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("signing out of the admin area leads to sign in", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const signOuts = await answerSignOut(page, 204);
    await page.goto("/admin");
    if (isMobile) {
      await sidebarToggle(page).click();
    }

    await page.getByRole("button", { name: "Account menu for Đạt Phan" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText("dat.phan@example.com")).toBeVisible();
    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/sign-in?returnTo=%2Fadmin");
    expect(signOuts).toEqual(["POST"]);
  });
});
