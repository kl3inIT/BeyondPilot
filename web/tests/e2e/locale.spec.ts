import { expect, type Page, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

/** Opens the header's language menu, named by the language it shows, and picks another. */
async function chooseLanguage(page: Page, current: string, language: string) {
  await page.getByRole("banner").getByRole("button", { name: current }).click();
  await page.getByRole("menu").getByRole("menuitemradio", { name: language }).click();
}

test.describe("locale routing", () => {
  test.use({ locale: "en-US" });

  test("English is served at the root without a prefix", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your next step in AI starts here.",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("Vietnamese is served under /vi", async ({ page }) => {
    await page.goto("/vi");

    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bước tiếp theo của bạn với AI bắt đầu từ đây.",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("an unknown path renders the localized not-found page", async ({ page }) => {
    const response = await page.goto("/vi/khong-ton-tai");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Không tìm thấy trang");
    await page.getByRole("link", { name: "Về trang chủ" }).click();
    await expect(page).toHaveURL("/vi");
  });
});

test.describe("header language menu", () => {
  test.use({ locale: "en-US" });

  test("opens the current page in the chosen language", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("banner").getByRole("button", { name: "Language: EN" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitemradio", { name: "English" })).toBeChecked();
    await expectNoSeriousA11yViolations(page);

    await menu.getByRole("menuitemradio", { name: "Tiếng Việt" }).click();
    await expect(page).toHaveURL("/vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Ngôn ngữ: VI" }),
    ).toBeVisible();
  });
});

test.describe("Spring-owned paths", () => {
  test.use({ locale: "en-US" });

  test("a page whose name only starts like a Spring path stays with the app", async ({ page }) => {
    const response = await page.goto("/loginpage");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  });
});

test.describe("a Vietnamese browser", () => {
  test.use({ locale: "vi-VN" });

  test("stays on the English site", async ({ page }) => {
    const home = await page.goto("/");

    expect(home?.request().redirectedFrom()).toBeNull();
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your next step in AI starts here.",
    );

    const inner = await page.goto("/how-it-works");

    expect(inner?.request().redirectedFrom()).toBeNull();
    await expect(page).toHaveURL("/how-it-works");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("reaches the Vietnamese site through the language menu, and English again", async ({
    page,
  }) => {
    await page.goto("/");

    await chooseLanguage(page, "Language: EN", "Tiếng Việt");
    await expect(page).toHaveURL("/vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bước tiếp theo của bạn với AI bắt đầu từ đây.",
    );

    await chooseLanguage(page, "Ngôn ngữ: VI", "English");
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

// An English browser, so that only the person's own choice can explain a Vietnamese page.
test.describe("the chosen language", () => {
  test.use({ locale: "en-US" });

  test("is kept at an address without a prefix, in both directions", async ({ page }) => {
    await page.goto("/");
    await chooseLanguage(page, "Language: EN", "Tiếng Việt");
    await expect(page).toHaveURL("/vi");

    await page.goto("/how-it-works");
    await expect(page).toHaveURL("/vi/how-it-works");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    await chooseLanguage(page, "Ngôn ngữ: VI", "English");
    await expect(page).toHaveURL("/how-it-works");

    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("is kept after a /vi address was opened", async ({ page }) => {
    await page.goto("/vi/how-it-works");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    await page.goto("/");
    await expect(page).toHaveURL("/vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });
});
