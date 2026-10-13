import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

/** The people shown, by the name each card leads with. */
function shownPeople(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link");
}

/** The way to write to the person, in the card beside the profile. */
function contact(page: Page, name: string) {
  return page.getByRole("link", { name: `Contact ${name}` });
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
    // Featured profiles lead the list, but public cards do not disclose operator curation.
    await expect(page.locator("[data-featured]")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Create a talent profile" }).first(),
    ).toHaveAttribute("href", "/workspace/talent");
    await expectNoSeriousA11yViolations(page);
  });

  test("search, the role and the sort are the address, and the server answers them", async ({
    page,
  }) => {
    await page.goto("/talent");

    await page.getByRole("searchbox", { name: "Search AI talent" }).fill("ocr");
    await expect(page).toHaveURL(/[?&]q=ocr/);
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat"]);
    await expect(page.getByText("Showing 1 of 1")).toBeVisible();

    await page.goto("/talent?role=forward_deployed_engineer&sort=name");
    await expect(shownPeople(page)).toHaveText(["Linh Nguyễn"]);

    await page.goto("/talent?sort=name");
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat", "Đạt Phan", "Linh Nguyễn"]);

    await page.goto("/talent");
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "ML engineer", exact: true }).click();
    await expect(page).toHaveURL(/[?&]role=ml_engineer/);
    await expect(shownPeople(page)).toHaveText(["Arif Hidayat"]);
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "All talent", exact: true }).click();
    await expect(shownPeople(page)).toHaveCount(3);

    await page.goto("/talent?q=nobody");
    await expect(page.getByText("No profile matches")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
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
    await expect(page.getByText("Stages are as the person states them.")).toBeVisible();
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

    // Contact leads to Messages; a visitor signs in first and comes back to the first message.
    const messages = "/workspace/messages?to=talent&at=linh-nguyen";
    await expect(contact(page, "Linh Nguyễn")).toHaveAttribute(
      "href",
      `/sign-in?returnTo=${encodeURIComponent(messages)}`,
    );
    await expect(page.getByText("Sign in to write to Linh Nguyễn.")).toBeVisible();
    await expect(
      page.getByText(
        "A first message waits until they accept, and your email address is never shown.",
      ),
    ).toBeVisible();
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

  test("a signed-in person's Contact leads to Messages, with the first message to write", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/talent/arif-hidayat");

    const messages = "/workspace/messages?to=talent&at=arif-hidayat";
    await expect(contact(page, "Arif Hidayat")).toHaveAttribute("href", messages);
    await expect(page.getByText("Sign in to write to Arif Hidayat.")).toHaveCount(0);
    // On a phone the action stays in reach in a bar at the foot of the screen.
    const bar = page.getByRole("link", { name: "Contact", exact: true });
    if (isMobile) {
      await expect(bar).toBeVisible();
      await expect(bar).toHaveAttribute("href", messages);
    } else {
      await expect(bar).toBeHidden();
    }
    await expectNoSeriousA11yViolations(page);
  });

  test("the person behind a profile edits it instead of writing to it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/talent/dat-phan");

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
