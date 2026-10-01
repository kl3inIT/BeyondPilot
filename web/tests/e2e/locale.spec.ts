import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

test.describe("locale routing", () => {
  test.use({ locale: "en-US" });

  test("English is served at the root without a prefix", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("BeyondPilot");
    await expect(page.getByText("Connecting enterprises with AI solution providers")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("Vietnamese is served under /vi", async ({ page }) => {
    await page.goto("/vi");

    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect(
      page.getByText("Kết nối doanh nghiệp với nhà cung cấp giải pháp AI"),
    ).toBeVisible();
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

test.describe("Spring-owned paths", () => {
  test.use({ locale: "en-US" });

  test("a page whose name only starts like a Spring path stays with the app", async ({ page }) => {
    const response = await page.goto("/loginpage");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  });
});

test.describe("first visit from a Vietnamese browser", () => {
  test.use({ locale: "vi-VN" });

  test("is sent to the Vietnamese site", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/vi");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  });
});
