import { expect, test } from "@playwright/test";

test.describe("security headers", () => {
  test("each page carries its own script nonce and nothing on it breaks the policy", async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    const home = await page.goto("/");
    const policy = home?.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(home?.headers()["strict-transport-security"]).toBe("max-age=31536000");
    expect(home?.headers()["x-powered-by"]).toBeUndefined();
    await page.waitForLoadState("networkidle");

    const solutions = await page.goto("/solutions");
    expect(solutions?.headers()["content-security-policy"]).not.toBe(policy);
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });
});
