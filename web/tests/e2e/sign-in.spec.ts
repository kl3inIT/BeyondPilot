import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";

// The backend is not part of this run: its sign-in answers are stood in for here, and its own tests
// cover what it does with a request.
async function answerCodeRequests(
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

/** Answers each typed code with the next status of the list, repeating the last one. */
async function answerTypedCodes(page: Page, ...statuses: number[]) {
  const codes: string[] = [];
  await page.route("**/login/ott", async (route) => {
    codes.push(new URLSearchParams(route.request().postData() ?? "").get("code") ?? "");
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    await route.fulfill({ status: statuses[Math.min(codes.length, statuses.length) - 1] });
  });
  return codes;
}

async function askForCode(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
}

test.describe("sign in", () => {
  test.use({ locale: "en-US" });

  test("an address gets a code, and the code opens the page the person was on", async ({
    page,
  }) => {
    const requests = await answerCodeRequests(page, 204);
    const codes = await answerTypedCodes(page, 204);
    await page.goto("/sign-in?returnTo=/programs");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to BeyondPilot");
    await expectNoSeriousA11yViolations(page);

    await askForCode(page, "an.tran@tasco.com.vn");
    await expect(page.getByText("an.tran@tasco.com.vn")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Gmail" })).toHaveCount(0);
    expect(new URLSearchParams(requests[0]).get("username")).toBe("an.tran@tasco.com.vn");
    expect(new URLSearchParams(requests[0]).get("locale")).toBe("en");
    await expectNoSeriousA11yViolations(page);

    // The sixth digit sends the code; no button is needed.
    await page.getByLabel("Sign-in code").pressSequentially("606096");

    await expect(page).toHaveURL("/programs");
    expect(codes).toEqual(["606096"]);
  });

  test("a wrong code can be typed again", async ({ page }) => {
    await answerCodeRequests(page, 204);
    const codes = await answerTypedCodes(page, 401, 204);
    await page.goto("/sign-in");
    await askForCode(page, "an.tran@tasco.com.vn");

    await page.getByLabel("Sign-in code").pressSequentially("111111");

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "That code is not right. Check the newest email and try again." }),
    ).toBeVisible();
    await expect(page.getByLabel("Sign-in code")).toHaveValue("");
    await expect(page.getByLabel("Sign-in code")).toHaveAttribute("aria-invalid", "true");
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel("Sign-in code").pressSequentially("606096");
    await expect(page).toHaveURL("/");
    expect(codes).toEqual(["111111", "606096"]);
  });

  test("an expired code asks for a new one, and a new one clears the message", async ({ page }) => {
    const requests = await answerCodeRequests(page, 204);
    await answerTypedCodes(page, 410);
    await page.goto("/sign-in");
    await askForCode(page, "an.tran@tasco.com.vn");

    await page.getByLabel("Sign-in code").pressSequentially("606096");
    await expect(
      page.getByRole("alert").filter({ hasText: "This code has expired. Send a new one below." }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByText("Sent a new code.")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "expired" })).toHaveCount(0);
    expect(requests).toHaveLength(2);
  });

  test("too many wrong codes close the field until a new code is sent", async ({ page }) => {
    await answerCodeRequests(page, 204);
    await answerTypedCodes(page, 429);
    await page.goto("/sign-in");
    await askForCode(page, "an.tran@tasco.com.vn");

    await page.getByLabel("Sign-in code").pressSequentially("111111");

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Too many wrong codes. Send a new code to try again." }),
    ).toBeVisible();
    await expect(page.getByLabel("Sign-in code")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

    await page.getByRole("button", { name: "Send a new code" }).click();
    await expect(page.getByLabel("Sign-in code")).toBeEnabled();
  });

  test("a Gmail address is offered its inbox", async ({ page }) => {
    await answerCodeRequests(page, 204);
    await page.goto("/sign-in");

    await askForCode(page, "an.tran.builds@gmail.com");

    await expect(page.getByRole("link", { name: "Open Gmail" })).toHaveAttribute(
      "href",
      "https://mail.google.com/",
    );
  });

  test("another address can be used instead", async ({ page }) => {
    await answerCodeRequests(page, 204);
    await page.goto("/sign-in");
    await askForCode(page, "an.tran@tasco.com.vn");

    await page.getByRole("button", { name: "Use a different email" }).click();

    await expect(page.getByLabel("Email")).toHaveValue("an.tran@tasco.com.vn");
  });

  test("something that is not an address is refused before any request", async ({ page }) => {
    const requests = await answerCodeRequests(page, 204);
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("not an address");
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();

    await expect(page.getByText("Enter an email address like name@company.com.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toHaveLength(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a failed send says so and keeps the form", async ({ page }) => {
    await answerCodeRequests(page, 503);
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();

    const alert = page.getByRole("alert").filter({ hasText: "We couldn't send the email" });
    await expect(alert).toContainText("an.tran@tasco.com.vn");
    // The pointer is still on the submit button. Its hover colour (primary at 90%) is below 4.5:1,
    // a finding about every primary button that is reported separately; this check reads the alert.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);
  });

  test("the fourth request says when another code can be asked for", async ({ page }) => {
    await answerCodeRequests(page, 429, { "Retry-After": "720" });
    await page.goto("/sign-in");

    await askForCode(page, "an.tran@tasco.com.vn");

    await expect(page.getByText("You can ask for another in 12 minutes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new code" })).toHaveCount(0);
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
    await answerCodeRequests(page, 204);
    await answerTypedCodes(page, 204);
    await page.goto("/sign-in?returnTo=//evil.example");

    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      "/oauth2/authorization/google",
    );
    await askForCode(page, "an.tran@tasco.com.vn");
    await page.getByLabel("Sign-in code").pressSequentially("606096");
    await expect(page).toHaveURL("/");
  });

  test("the Vietnamese page asks for a Vietnamese email", async ({ page }) => {
    const requests = await answerCodeRequests(page, 204);
    await page.goto("/vi/sign-in");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đăng nhập BeyondPilot");
    await page.getByLabel("Email").fill("an.tran@tasco.com.vn");
    await page.getByRole("button", { name: "Gửi mã đăng nhập cho tôi" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiểm tra email của bạn");
    expect(new URLSearchParams(requests[0]).get("locale")).toBe("vi");
  });
});
