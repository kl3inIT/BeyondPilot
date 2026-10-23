import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

// An event of GenAI Fund's Luma calendar that people register for on BeyondPilot (BEY-245): its
// page as Luma lays it out, and the card that registers. The stub answers the event and its form;
// a registration sent is caught here and its status set for this browser by a cookie.

test.describe("events from Luma", () => {
  test("a signed-in person registers with the host's questions and sees it waits for approval", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "member", baseURL!);
    let sent: unknown;
    await page.route("**/api/program/programs/gaf-briefing/registration", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      sent = route.request().postDataJSON();
      await context.addCookies([
        { name: "BEYONDPILOT_E2E_REGISTERED", value: "pending_approval", url: baseURL! },
      ]);
      await route.fulfill({ status: 200, json: {} });
    });
    await page.goto("/programs/gaf-briefing");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Product briefing");
    await expect(
      page.getByText("The address is shown once your registration is confirmed."),
    ).toBeVisible();
    await expect(page.getByText("Hosted by").first()).toBeAttached();
    // The name the host asks again is the person's own, not a second field.
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(1);
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel("Name", { exact: true }).fill("Linh Tran");
    await page.getByRole("button", { name: "Request to join" }).click();
    await expect(page.getByText("Fill this in.").first()).toBeVisible();
    expect(sent).toBeUndefined();

    await page.getByRole("combobox", { name: "Your role" }).click();
    await page.getByRole("option", { name: "Builder" }).click();
    await page.getByLabel("Company").fill("Plain Cover");
    await page.getByLabel("Job title").fill("CTO");
    await page.getByRole("checkbox", { name: "I agree to the terms" }).click();
    await page.getByRole("button", { name: "Request to join" }).click();

    await expect(page.getByRole("status")).toContainText("Pending approval");
    expect(sent).toEqual({
      name: "Linh Tran",
      formVersion: "v1",
      answers: [
        { questionId: "q-role", text: "Builder" },
        { questionId: "q-company", company: "Plain Cover", jobTitle: "CTO" },
        { questionId: "q-terms", agreed: true },
      ],
    });
    await expectNoSeriousA11yViolations(page);
  });

  test("a visitor types the emailed code in the card and is registered", async ({
    page,
    context,
    baseURL,
  }) => {
    const calls: string[] = [];
    await page.route("**/ott/generate", async (route) => {
      calls.push(`code ${new URLSearchParams(route.request().postData() ?? "").get("username")}`);
      await route.fulfill({ status: 204 });
    });
    await page.route("**/login/ott", async (route) => {
      calls.push(`check ${new URLSearchParams(route.request().postData() ?? "").get("code")}`);
      await signInAs(context, "member", baseURL!);
      await route.fulfill({ status: 204 });
    });
    // Signed in, the card asks who it is: an account that has agreed to the consent text.
    await page.route("**/api/identity/me", (route) =>
      route.fulfill({
        status: 200,
        json: {
          id: "0b4c8e1a-7f2d-4c3b-9a1e-5d6f7a8b9c0d",
          email: "linh@events.test",
          displayName: null,
          role: "user",
          consentNeeded: false,
        },
      }),
    );
    await page.route("**/api/program/programs/gaf-briefing/registration", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      calls.push("register");
      await context.addCookies([
        { name: "BEYONDPILOT_E2E_REGISTERED", value: "approved", url: baseURL! },
      ]);
      await route.fulfill({ status: 200, json: {} });
    });
    await page.goto("/programs/gaf-briefing");

    await page.getByLabel("Name", { exact: true }).fill("Linh Tran");
    await page.getByLabel("Email").fill("linh@events.test");
    await page.getByRole("combobox", { name: "Your role" }).click();
    await page.getByRole("option", { name: "Investor" }).click();
    await page.getByLabel("Company").fill("Plain Cover");
    await page.getByLabel("Job title").fill("CTO");
    await page.getByRole("checkbox", { name: "I agree to the terms" }).click();
    await page.getByRole("button", { name: "Request to join" }).click();

    await expect(page.getByText("Enter the code we sent to")).toContainText("linh@events.test");
    // The sixth digit sends the code; no button is needed.
    await page.getByLabel("Sign-in code").pressSequentially("123456");

    await expect(page.getByRole("status")).toContainText("You're in");
    await expect(page.getByRole("link", { name: "Add to calendar" })).toBeVisible();
    await expect(page.getByText("24 Nguyễn Thị Nghĩa, Quận 1").first()).toBeVisible();
    expect(calls).toEqual(["code linh@events.test", "check 123456", "register"]);
  });
});
