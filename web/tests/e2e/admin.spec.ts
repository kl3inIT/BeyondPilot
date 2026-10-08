import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerSignOut, signInAs } from "./session";
import { serveStoredImages } from "./stored-files";

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
    await expect(page.getByText("7 records wait for a decision.")).toBeVisible();
    for (const [queue, count, href] of [
      ["Organizations to review", 2, "/admin/organizations?status=in_review"],
      ["Solutions to review", 2, "/admin/solutions?status=in_review"],
      ["Talent profiles to review", 2, "/admin/talent?status=in_review"],
      // A deployment is reviewed on its solution, so the whole list opens, those holding one first.
      ["Customer deployments to review", 1, "/admin/solutions"],
    ] as const) {
      const link = page.getByRole("main").getByRole("link", { name: queue });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toContainText(String(count));
    }

    await page.getByRole("main").getByRole("link", { name: "Solutions to review" }).click();
    await expect(page).toHaveURL("/admin/solutions?status=in_review");
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
  test("the use-case list shows organization logos or two-letter initials", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await serveStoredImages(page);
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/use-cases");
    const records = isMobile ? page.getByRole("listitem") : page.getByRole("row");


    const withLogo = records.filter({ hasText: "Claims triage" });
    await expect(withLogo.locator("img")).toHaveCount(1);
    const withoutLogo = records.filter({ hasText: "Inventory counting" });
    await expect(withoutLogo.getByText("TA", { exact: true })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("an operator writes a use case in steps and publishes it immediately", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    let submitted: Record<string, unknown> | undefined;
    await page.route("**/api/usecase/admin/use-cases", async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, json: {} });
    });
    await page.goto("/admin/use-cases/new");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create a use case");
    await expect(page.getByRole("navigation", { name: "Steps of the use case" })).toContainText(
      "Review and publish",
    );
    await expect(page.getByText("Submit for approval", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Save draft", { exact: true })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Create this use case for" }).click();
    await page.getByRole("option", { name: "Pocket Policy" }).click();
    await page.getByLabel("Use case title").fill("Faster claims triage");
    await page
      .getByLabel("Problem statement")
      .fill("Claims handlers spend hours sorting incoming documents.");
    await page.getByRole("combobox", { name: "Industry" }).click();
    await page.getByRole("option", { name: "Insurance" }).click();
    await page.getByRole("checkbox", { name: "Document Intelligence" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Expected outcomes and success metrics").fill("Cut triage time by 50%.");
    await page.getByLabel("Current process").fill("Handlers inspect every document manually.");
    await page.getByLabel("Target users and impacted teams").fill("Claims operations.");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Requirement 1").fill("Classify every uploaded claim document.");
    await page.getByLabel("Requirement 2").fill("Extract policy and claimant identifiers.");
    await page.getByLabel("Requirement 3").fill("Flag unreadable documents.");
    await page
      .getByLabel("Data availability and readiness")
      .fill("Anonymized PDF claims are ready.");
    await page
      .getByLabel("Integration, deployment and infrastructure")
      .fill("Connect to the claims API.");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("checkbox", { name: "Budget to be determined" }).click();
    await page.getByRole("combobox", { name: "Preferred timeline" }).click();
    await page.getByRole("option", { name: "4–8 weeks" }).click();
    const closes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel("Proposals close").fill(closes);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Review and publish");
    await expect(
      page.getByText("Publishing makes this use case visible immediately."),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    expect(submitted).toBeUndefined();
    await page.getByRole("button", { name: "Publish use case" }).click();

    await expect.poll(() => submitted).toBeDefined();
    await expect(page).toHaveURL("/admin/use-cases");
    expect(submitted).toMatchObject({
      organizationId: "8b3e5c74-2b20-4c75-9c77-2f5b8b8d9c03",
      title: "Faster claims triage",
      publishNow: true,
    });

  test("the admin account menu leads back to the site and sets the language and appearance", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin");
    const openMenu = async () => {
      const account = page.getByRole("button", { name: /^(Account menu|Menu tài khoản)/ });
      // On a phone the sidebar is a sheet, which may still be open from the last choice.
      if (isMobile && !(await account.isVisible())) {
        await page
          .getByRole("main")
          .getByRole("button", { name: /^(Toggle sidebar|Thu gọn hoặc mở thanh bên)$/ })
          .click();
      }
      await account.click();
      return page.getByRole("menu").first();
    };

    // The person's own pages are the site's; the admin menu holds what the admin area lacks.
    let menu = await openMenu();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Back to the site",
      /^LanguageEnglish/,
      /^AppearanceLight/,
      "Sign out",
    ]);
    await expectNoSeriousA11yViolations(page);

    await menu.getByRole("menuitem", { name: /^Appearance/ }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    menu = await openMenu();
    await menu.getByRole("menuitem", { name: /^Language/ }).click();
    await page.getByRole("menuitemradio", { name: "Tiếng Việt" }).click();
    await expect(page).toHaveURL("/vi/admin");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    menu = await openMenu();
    await menu.getByRole("menuitem", { name: "Về trang chính" }).click();
    await expect(page).toHaveURL("/vi");
  });
});
