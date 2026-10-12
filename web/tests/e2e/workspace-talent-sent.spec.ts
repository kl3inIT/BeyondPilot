import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const sent = "/workspace/talent/sent";

test.describe("messages a person sent through talent profiles", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in and back", async ({ page }) => {
    const answer = await page.request.get(sent, { maxRedirects: 0 });

    expect(answer.status()).toBe(307);
    expect(answer.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(sent)}`);
  });

  test("a sender reads one row a person, the waiting message first, with what they wrote before", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(sent);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages you sent");
    const people = page.getByRole("list", { name: "People you wrote to" });
    await expect(people.getByRole("button")).toHaveCount(2);
    const open = page.getByRole("article");
    await expect(open.getByRole("heading", { level: 2 })).toHaveText(
      "Your message waits for Linh Tran",
    );
    await expect(open.getByText("Their email address is shared only if they accept")).toBeVisible();
    const earlier = open.getByRole("region", { name: "Earlier messages to Linh Tran" });
    await expect(earlier.getByText("An OCR pilot for claims forms?")).toBeVisible();
    await expect(open.getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/talent/linh-tran",
    );
    await expectNoSeriousA11yViolations(page);

    await people.getByRole("button", { name: /Tran Quoc Bao/ }).click();

    await expect(open.getByRole("heading", { level: 2 })).toHaveText(
      "Tran Quoc Bao accepted your message",
    );
    await expect(open.getByRole("link", { name: "Write an email" })).toHaveAttribute(
      "href",
      "mailto:bao.tran@example.com",
    );
    // A profile that left the directory has no page to link to.
    await expect(open.getByRole("link", { name: "View profile" })).toHaveCount(0);
  });

  test("a person who wrote to nobody is shown the way to the directory", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(sent);

    await expect(
      page.getByRole("heading", { name: "You have not written to anyone yet" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse AI talent" })).toHaveAttribute(
      "href",
      "/talent",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("the account menu leads to it", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto("/");

    await page.getByRole("button", { name: /Account menu/ }).click();

    await expect(page.getByRole("menuitem", { name: "Messages you sent" })).toHaveAttribute(
      "href",
      sent,
    );
  });
});
