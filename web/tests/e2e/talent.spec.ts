import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const enquiriesPath = "**/api/talent/profiles/*/enquiries";

/** The people shown, by the name each card leads with. */
function shownPeople(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link");
}

/** The first way to write to the person: in the card, or in the bar at the foot of a phone. */
function discussProject(page: Page) {
  return page.getByRole("button", { name: "Discuss a project" }).first();
}

test.describe("talent directory", () => {
  test.use({ locale: "en-US" });

  test("a visitor reads the approved profiles and is offered one of their own", async ({
    page,
  }) => {
    await page.goto("/talent");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI talent");
    await expect(shownPeople(page)).toHaveText(["Linh Nguyễn", "Arif Hidayat", "Đạt Phan"]);
    await expect(page.getByText("Showing 3 of 3")).toBeVisible();
    await expect(page.getByText("ML engineer · Indonesia")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create a talent profile" }).first(),
    ).toHaveAttribute("href", "/workspace/talent");
    await expectNoSeriousA11yViolations(page);
  });

  test("search and the facets are the address, and the server answers them", async ({ page }) => {
    await page.goto("/talent");

    await page.getByRole("searchbox", { name: "Search talent by name or skill" }).fill("ocr");
    await expect(page).toHaveURL(/[?&]q=ocr/);
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat"]);
    await expect(page.getByText("Showing 1 of 1")).toBeVisible();

    await page.goto("/talent?role=forward_deployed_engineer&availability=available&sort=name");
    await expect(shownPeople(page)).toHaveText(["Linh Nguyễn"]);

    await page.goto("/talent?sort=name");
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat", "Đạt Phan", "Linh Nguyễn"]);

    await page.goto("/talent?q=nobody");
    await expect(page.getByRole("heading", { name: "No profile matches" })).toBeVisible();
    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL("/talent");
    await expect(shownPeople(page)).toHaveCount(3);
  });

  test("a profile says who the person is, and a visitor signs in before writing to them", async ({
    page,
  }) => {
    await page.goto("/talent");
    await page.getByRole("link", { name: "Linh Nguyễn" }).click();

    await expect(page).toHaveURL("/talent/linh-nguyen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Linh Nguyễn");
    await expect(page.getByText("Claims assistant for an insurer")).toBeVisible();
    await expect(page.getByText("Stated by the person", { exact: true })).toBeVisible();
    await expect(page.getByText("Contract, Advisory")).toBeVisible();
    await expect(page.getByText("$50–100 an hour")).toBeVisible();
    await expect(page.getByRole("link", { name: "linkedin.com" })).toBeVisible();
    // The person's address is on no public page.
    await expect(page.getByRole("main").getByText("@")).toHaveCount(0);

    const signIn = "/sign-in?returnTo=%2Ftalent%2Flinh-nguyen";
    await expect(page.getByRole("link", { name: "Discuss a project" }).first()).toHaveAttribute(
      "href",
      signIn,
    );
    await expect(page.getByRole("link", { name: "Ask about a role" })).toHaveAttribute(
      "href",
      signIn,
    );
    await expect(page.getByText("Sign in to write to Linh Nguyễn.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a profile with little on it says what is not listed, and an unknown one is not found", async ({
    page,
  }) => {
    await page.goto("/talent/arif-hidayat");

    await expect(page.getByText("No deployed project published yet.")).toBeVisible();
    await expect(page.getByText("Not listed yet")).toBeVisible();

    expect((await page.goto("/talent/no-such-person"))?.status()).toBe(404);
  });

  test("a signed-in person writes to a profile, and a message is needed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const sent = await answerDecisions(page, enquiriesPath, 204);
    await page.goto("/talent/arif-hidayat");

    await discussProject(page).click();
    const message = page.getByRole("textbox", { name: "Tell Arif Hidayat about your project" });
    await expect(message).toBeFocused();

    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Write a message first.")).toBeVisible();
    expect(sent).toEqual([]);
    await expectNoSeriousA11yViolations(page);

    await message.fill("We need OCR for claim forms.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Message sent to Arif Hidayat")).toBeVisible();
    await expect(page.getByText("They will answer to your email address.")).toBeVisible();
    // One message is the conversation's start; the ways to write again are gone.
    await expect(page.getByRole("button", { name: "Discuss a project" })).toHaveCount(0);
    expect(sent).toEqual([
      {
        call: "POST /api/talent/profiles/arif-hidayat/enquiries",
        body: { message: "We need OCR for claim forms." },
      },
    ]);
  });

  test("a second message on the same day is refused in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await answerDecisions(page, enquiriesPath, 429, refusal("TALENT_ENQUIRY_TOO_SOON"));
    await page.goto("/talent/arif-hidayat");

    await page.getByRole("button", { name: "Ask about a role" }).click();
    await page.getByRole("textbox", { name: "Ask Arif Hidayat about a role" }).fill("Again.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByText("You already wrote to this person today. Try again tomorrow."),
    ).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    // The message is kept, so it can be sent another day.
    await expect(page.getByRole("textbox")).toHaveValue("Again.");
  });

  test("the person behind a profile edits it instead of writing to it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/talent/dat-phan");

    await expect(page.getByText("This is your profile, as others see it.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit your profile" })).toHaveAttribute(
      "href",
      "/workspace/talent",
    );
    await expect(page.getByRole("button", { name: "Discuss a project" })).toHaveCount(0);

    await page.goto("/talent");
    await expect(page.getByRole("link", { name: "Edit your profile" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a talent profile" })).toHaveCount(0);
  });
});
