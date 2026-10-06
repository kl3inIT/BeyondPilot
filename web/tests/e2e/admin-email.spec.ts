import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

/** Answers the preview of a draft with the problems the backend finds in it, and records each draft. */
async function answerPreview(page: Page) {
  const drafts: { subject: string; body: string }[] = [];
  await page.route("**/api/notification/admin/email/templates/*/preview", async (route) => {
    const draft = route.request().postDataJSON() as { subject: string; body: string };
    drafts.push(draft);
    const unknown = /\{\{organisation\}\}/.test(draft.body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subject: draft.subject.replaceAll("{{organizationName}}", "Plain Cover"),
        html: "<!doctype html><html><body><h1>Plain Cover is approved</h1></body></html>",
        text: "Plain Cover is approved",
        problems: unknown
          ? [{ field: "body", type: "unknown_variable", variable: "organisation" }]
          : [],
      }),
    });
  });
  return drafts;
}

test.describe("admin email", () => {
  test.use({ locale: "en-US" });

  test("nobody but an operator gets the email screens", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/email/templates", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);

    await signInAs(context, "unnamed", baseURL!);
    const answer = await page.goto("/admin/email/templates");
    expect(answer?.status()).toBe(404);
  });

  test("templates are grouped by what sends them, and say that no email can leave yet", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/email");

    await expect(page).toHaveURL(/\/admin\/email\/templates$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Email");
    await expect(page.getByRole("status")).toContainText("No email can leave yet");
    await expect(page.getByRole("heading", { level: 2, name: "Organizations" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Organization approved/ })).toContainText("Edited");
    await expectNoSeriousA11yViolations(page);
  });

  test("an operator words an email and sees what keeps it from being saved", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const drafts = await answerPreview(page);
    await page.goto("/admin/email/templates/organization_approved");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organization approved");
    await expect(page.getByTitle("Preview of Organization approved")).toBeVisible();

    const body = page.getByRole("textbox", { name: "Body" });
    await body.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(" {{organisation}}");

    await expect(page.getByText("{{organisation}} is not a variable of this email.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send me a test" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("You have unsaved changes");
    expect(drafts.at(-1)?.body).toContain("{{organisation}}");
  });

  test("the log counts the period's emails and opens one with what happened to it", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/email/activity");

    await expect(page.getByText("Emails, 7 days")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(isMobile ? 0 : 1);
    await expectNoSeriousA11yViolations(page);

    await page.goto("/admin/email/activity?status=bounced");
    await page
      .getByRole("link", { name: /bounced@nowhere\.example|Organization invitation/ })
      .first()
      .click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "You are invited to Plain Cover on BeyondPilot",
    );
    await expect(page.getByText("This address receives no email")).toBeVisible();
    await expect(page.getByText("550 5.1.1 The email account does not exist")).toBeVisible();
    // A bounced email waits for its address to be let through before it is sent again.
    await expect(page.getByRole("button", { name: "Send again" })).toHaveCount(0);
  });

  test("suppressed addresses say why and where from", async ({ page, context, baseURL }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/email/suppressions");

    await expect(
      page.getByText("bounced@nowhere.example").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Bounced").filter({ visible: true }).first()).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "Let email reach bounced@nowhere.example again" })
        .filter({ visible: true }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("settings ask for the provider's key before anything is sent", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/email/settings");

    await expect(page.getByRole("radio", { name: /Resend/ })).toBeChecked();
    await expect(page.getByLabel("Address for the provider")).toHaveValue(
      "https://beyondpilot.vadan.app/api/notification/email/events/resend",
    );
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("textbox", { name: "API key" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await page.getByRole("radio", { name: /SMTP/ }).check();
    await expect(page.getByRole("textbox", { name: "Server" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("once email is set up, Settings shows what the provider says and the records to publish", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "emailer", baseURL!);
    // What SES says of beyondpilot.ai: verified, DKIM still waiting, the account still in its sandbox.
    await page.route("**/api/notification/admin/email/settings/checks", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "ses",
          domain: "beyondpilot.ai",
          checkedAt: new Date().toISOString(),
          limit: null,
          checks: [
            { step: "credentials", state: "ok" },
            { step: "sending_enabled", state: "ok" },
            { step: "production_access", state: "pending" },
            { step: "domain_added", state: "ok" },
            { step: "domain_verified", state: "ok" },
            { step: "dkim", state: "pending" },
          ],
          records: [
            ...["a1b2c3", "d4e5f6", "g7h8i9"].map((token) => ({
              purpose: "dkim",
              type: "CNAME",
              host: `${token}._domainkey`,
              value: `${token}.dkim.amazonses.com`,
              priority: null,
              state: "pending",
            })),
            {
              purpose: "dmarc",
              type: "TXT",
              host: "_dmarc",
              value: "v=DMARC1; p=none;",
              priority: null,
              state: "unknown",
            },
          ],
        }),
      }),
    );
    await page.goto("/admin/email/settings");

    const setup = page.getByRole("region", { name: "Setup" });
    await expect(setup).toContainText("What the provider says about sending from beyondpilot.ai");
    await expect(setup.getByRole("heading", { level: 2 })).toHaveText("Setup · 4 of 6 done");
    await expect(setup).toContainText("Sandbox: only verified addresses receive email");
    await expect(setup).toContainText("Waiting for the DKIM records");
    await expect(setup).toContainText("The domain is verified");
    const records = isMobile ? setup.locator("ul li") : setup.getByRole("row");
    await expect(records.filter({ hasText: "a1b2c3._domainkey" })).toHaveCount(1);
    await expect(setup.getByText("v=DMARC1; p=none;").filter({ visible: true })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
