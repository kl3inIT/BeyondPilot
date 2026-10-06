import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";

const enquiriesPath = "**/api/talent/profiles/*/enquiries";

/** The people shown, by the name each card leads with. */
function shownPeople(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link");
}

/** The way to write to the person, in the card beside the profile. */
function contact(page: Page, name: string) {
  return page.getByRole("button", { name: `Contact ${name}` });
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

    await page.goto("/talent");
    await page.getByRole("button", { name: "ML engineer" }).click();
    await expect(page).toHaveURL(/[?&]role=ml_engineer/);
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat"]);
    await page.getByRole("button", { name: "All talent" }).click();
    await expect(shownPeople(page)).toHaveCount(3);

    await page.goto("/talent?q=nobody");
    await expect(page.getByText("No profile matches")).toBeVisible();
    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL("/talent");
    await expect(shownPeople(page)).toHaveCount(3);
  });

  test("the directory narrows by country and by what a person is open to, in the URL", async ({
    page,
  }) => {
    await page.goto("/talent?country=ID");
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat"]);

    await page.goto("/talent?engagement=contract");
    await expect(shownPeople(page)).toHaveCount(3);
    await expect(page.getByText("Ho Chi Minh City").first()).toBeVisible();
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
    await expect(page.getByText("In production", { exact: true })).toBeVisible();
    await expect(page.getByText("project on the profile")).toBeVisible();
    await expect(page.getByText("Vietnamese, English")).toBeVisible();
    await expect(page.getByText("Revee AI")).toBeVisible();
    // The rate is for the person and GenAI Fund, not the public.
    await expect(page.getByText("an hour")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "linkedin.com" })).toBeVisible();
    // The person's address is on no public page.
    await expect(page.getByRole("main").getByText("@")).toHaveCount(0);

    const signIn = "/sign-in?returnTo=%2Ftalent%2Flinh-nguyen";
    await expect(page.getByRole("link", { name: "Contact Linh Nguyễn" })).toHaveAttribute(
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
    // With no project there is nothing to count.
    await expect(page.getByText("on the profile")).toHaveCount(0);

    expect((await page.goto("/talent/no-such-person"))?.status()).toBe(404);
  });

  test("a signed-in person writes to a profile about a topic, and a message is needed", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const sent = await answerDecisions(page, enquiriesPath, 204);
    await page.goto("/talent/arif-hidayat");

    await contact(page, "Arif Hidayat").click();
    const dialog = page.getByRole("dialog", { name: "Contact Arif Hidayat" });
    await expect(
      dialog.getByText("Neither email address is shared unless they accept."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.getByText("Write a message first.")).toBeVisible();
    expect(sent).toEqual([]);
    // The pointer rests on the button that was pressed; its hover colour is not what is checked.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    await dialog.getByLabel("What it is about").selectOption("role");
    await dialog.getByRole("textbox", { name: "Your message" }).fill("Would you lead our pilot?");
    await dialog.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Your message is on its way to Arif Hidayat")).toBeVisible();
    expect(sent).toEqual([
      {
        call: "POST /api/talent/profiles/arif-hidayat/enquiries",
        body: { topic: "role", message: "Would you lead our pilot?" },
      },
    ]);
  });

  test("a second message while the first waits is refused in the words of its code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await answerDecisions(page, enquiriesPath, 409, refusal("TALENT_ENQUIRY_PENDING"));
    await page.goto("/talent/arif-hidayat");

    await contact(page, "Arif Hidayat").click();
    await page.getByRole("textbox", { name: "Your message" }).fill("Again.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByText("Your message to this person waits for their answer."),
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
    await expect(contact(page, "Đạt Phan")).toHaveCount(0);

    await page.goto("/talent");
    await expect(page.getByRole("link", { name: "Edit your profile" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create a talent profile" })).toHaveCount(0);
  });
});
