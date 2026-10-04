import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

// The backend is not part of this run: its sign-in answers are stood in for here, and its own tests
// cover what it does with a request.
async function answerLinkRequests(
  page: Page,
  status: number,
  headers: Record<string, string> = {},
) {
  const requests: string[] = [];
  await page.route("**/ott/generate", async (route) => {
    requests.push(route.request().postData() ?? "");
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    await route.fulfill({ status, headers });
  });
  return requests;
}

test.describe("sign in", () => {
  test.use({ locale: "en-US" });

  test("an address gets a link and the screen says where it went", async ({ page }) => {
    const requests = await answerLinkRequests(page, 204);
    await page.goto("/sign-in?returnTo=/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to BeyondPilot");
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
    await expect(page.getByText("an.tran@tasco.com.vn")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Gmail" })).toHaveCount(0);
    expect(new URLSearchParams(requests[0]).get("returnTo")).toBe("/programs");
    expect(new URLSearchParams(requests[0]).get("locale")).toBe("en");
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Send it again" }).click();
    await expect(page.getByText("Sent again.")).toBeVisible();
    expect(requests).toHaveLength(2);

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email")).toHaveValue("an.tran@tasco.com.vn");
  });

  test("a Gmail address is offered its inbox", async ({ page }) => {
    await answerLinkRequests(page, 204);
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("an.tran.builds@gmail.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByRole("link", { name: "Open Gmail" })).toHaveAttribute(
      "href",
      "https://mail.google.com/",
    );
  });

  test("something that is not an address is refused before any request", async ({ page }) => {
    const requests = await answerLinkRequests(page, 204);
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("not an address");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByText("Enter an email address like name@company.com.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toHaveLength(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a failed send says so and keeps the form", async ({ page }) => {
    await answerLinkRequests(page, 503);
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    const alert = page.getByRole("alert").filter({ hasText: "We couldn't send the email" });
    await expect(alert).toContainText("an.tran@tasco.com.vn");
    // The pointer is still on the submit button. Its hover colour (primary at 90%) is below 4.5:1,
    // a finding about every primary button that is reported separately; this check reads the alert.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);
  });

  test("the fourth request says when another link can be asked for", async ({ page }) => {
    await answerLinkRequests(page, 429, { "Retry-After": "720" });
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByText("You can ask for another in 12 minutes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  });

  test("Google is a link to the backend that keeps the return path", async ({ page }) => {
    await page.goto("/sign-in?returnTo=/programs&error=google");

    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/oauth2/authorization/google?returnTo=%2Fprograms",
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Google sign-in did not finish" }),
    ).toBeVisible();
  });

  test("a return path to another site is dropped", async ({ page }) => {
    await page.goto("/sign-in?returnTo=//evil.example");

    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/oauth2/authorization/google",
    );
  });

  test("the Vietnamese page asks for a Vietnamese email", async ({ page }) => {
    const requests = await answerLinkRequests(page, 204);
    await page.goto("/vi/sign-in");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đăng nhập BeyondPilot");
    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Gửi link đăng nhập cho tôi" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiểm tra email của bạn");
    expect(new URLSearchParams(requests[0]).get("locale")).toBe("vi");
  });
});

test.describe("the emailed link", () => {
  test.use({ locale: "en-US" });

  test("a working link signs in and opens the page the person was on", async ({ page }) => {
    let token = "";
    await page.route("**/login/ott", async (route) => {
      token = new URLSearchParams(route.request().postData() ?? "").get("token") ?? "";
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      await route.fulfill({ status: 204 });
    });

    await page.goto("/sign-in/link?token=abc-123&returnTo=/programs");

    await expect(page).toHaveURL("/programs");
    expect(token).toBe("abc-123");
  });

  test("a link that no longer works asks for the address again", async ({ page }) => {
    await page.route("**/login/ott", (route) => route.fulfill({ status: 401 }));
    await answerLinkRequests(page, 204);

    await page.goto("/sign-in/link?token=used");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link no longer works");
    await expectNoSeriousA11yViolations(page);
    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Email me a new link" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
  });

  test("a link without a return path of this site opens the home page", async ({ page }) => {
    await page.route("**/login/ott", (route) => route.fulfill({ status: 204 }));

    await page.goto("/sign-in/link?token=abc-123&returnTo=https://evil.example");

    await expect(page).toHaveURL("/");
  });
});
