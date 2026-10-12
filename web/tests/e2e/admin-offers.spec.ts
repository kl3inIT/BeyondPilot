import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { answerOfferList, cloudCredits, onboarding } from "./offers";
import { answerDecisions, refusal } from "./reviews";
import { signInAs } from "./session";
import { serveStoredImages } from "./stored-files";

const policyChat = "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03";

const offersPath = "**/api/solution/admin/offers**";

test.describe("admin offers", () => {
  test.beforeEach(({ page }) => serveStoredImages(page));

  test.use({ locale: "en-US" });

  test("nobody but an operator gets the list of offers", async ({ page, context, baseURL }) => {
    const visitor = await page.request.get("/admin/offers", { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe("/sign-in?returnTo=%2Fadmin%2Foffers");

    await signInAs(context, "unnamed", baseURL!);
    expect((await page.goto("/admin/offers"))?.status()).toBe(404);
  });

  test("an operator reads the offers, each with where it is claimed and how many solutions come with it", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/offers");

    if (!isMobile) {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Offers");
    }
    await expect(page.getByText("$1,000 in cloud credits").filter({ visible: true })).toHaveCount(
      1,
    );
    await expect(
      page.getByRole("link", { name: "offers.example/cloud-credits" }).filter({ visible: true }),
    ).toHaveAttribute("href", "https://offers.example/cloud-credits");
    // The sidebar leads here, beside the solutions the offers go with.
    if (!isMobile) {
      await expect(
        page
          .getByRole("navigation", { name: "Admin navigation" })
          .getByRole("link", { name: "Offers" }),
      ).toHaveAttribute("aria-current", "page");
    }
    await expectNoSeriousA11yViolations(page);

    // An offer a solution still comes with is not deleted; one that goes with none can be.
    await page
      .getByRole("button", { name: "Actions for $1,000 in cloud credits" })
      .filter({ visible: true })
      .click();
    await expect(
      page
        .getByRole("menu", { name: "Actions for $1,000 in cloud credits" })
        .getByRole("menuitem", { name: "Delete…" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    const deletions = await answerDecisions(page, offersPath, 204);
    await page
      .getByRole("button", { name: "Actions for Ten hours of onboarding support" })
      .filter({ visible: true })
      .click();
    // The menu of this offer alone: the one before it may still be leaving the page.
    await page
      .getByRole("menu", { name: "Actions for Ten hours of onboarding support" })
      .getByRole("menuitem", { name: "Delete…" })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading")).toHaveText(
      "Delete Ten hours of onboarding support?",
    );
    await confirm.getByRole("button", { name: "Delete offer" }).click();
    await expect(page.getByText("Ten hours of onboarding support deleted.")).toBeVisible();
    expect(deletions).toEqual([
      { call: `DELETE /api/solution/admin/offers/${onboarding.id}`, body: null },
    ]);
  });

  test("an operator closes an offer to new solutions with the version the list read, and opens it again", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const writes = await answerDecisions(
      page,
      `**/api/solution/admin/offers/${cloudCredits.id}/closed`,
      200,
      {
        id: cloudCredits.id,
        title: cloudCredits.title,
        url: cloudCredits.url,
        organizationId: null,
        organizationName: null,
        solutions: 2,
        version: 1,
        updatedAt: "2026-10-03T07:32:00Z",
        closed: true,
      },
    );
    await page.goto("/admin/offers");
    // Both offers are open to new solutions.
    await expect(page.getByText("Open", { exact: true }).filter({ visible: true })).toHaveCount(2);

    await page
      .getByRole("button", { name: "Actions for $1,000 in cloud credits" })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("menu", { name: "Actions for $1,000 in cloud credits" })
      .getByRole("menuitem", { name: "Close to new solutions" })
      .click();

    await expect(
      page.getByText("$1,000 in cloud credits is closed to new solutions."),
    ).toBeVisible();
    expect(writes).toEqual([
      {
        call: `PUT /api/solution/admin/offers/${cloudCredits.id}/closed`,
        body: { closed: true, version: 0 },
      },
    ]);
    if (!isMobile) {
      await expectNoSeriousA11yViolations(page);
    }
  });

  test("an operator filters the offers by whether they are open", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/offers?state=closed");
    // None of the stub's offers is closed.
    await expect(
      page.getByText("No offer matches the search.").filter({ visible: true }),
    ).toBeVisible();
    await page.goto("/admin/offers?state=open&q=onboarding");
    await expect(
      page.getByText("Ten hours of onboarding support").filter({ visible: true }),
    ).toHaveCount(1);
    await expect(page.getByText("$1,000 in cloud credits")).toHaveCount(0);
  });

  test("an operator reads the record of an offer with the solutions that come with it", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/offers");
    await page
      .getByRole("link", { name: "$1,000 in cloud credits" })
      .filter({ visible: true })
      .click();

    await expect(page).toHaveURL(`/admin/offers/${cloudCredits.id}`);
    if (!isMobile) {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("$1,000 in cloud credits");
    }
    await expect(page.getByRole("button", { name: "Close to new solutions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Policy Chat" }).filter({ visible: true }),
    ).toHaveAttribute("href", `/admin/solutions/ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e03`);
    await expect(page.getByText("Lumen Health").filter({ visible: true })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // An offer there is none of answers as a page that does not exist.
    expect((await page.goto("/admin/offers/0ffe7a11-0000-4000-8000-0000000000ff"))?.status()).toBe(
      404,
    );
  });

  test("an offer is one line and an https address, and a title another offer has is said under the field", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto("/admin/offers");
    await page.getByRole("button", { name: "New offer" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New offer" })).toBeVisible();

    // Both are asked for, and the link is an https one, before anything is sent.
    const writes = await answerDecisions(
      page,
      offersPath,
      409,
      refusal("SOLUTION_OFFER_TITLE_TAKEN"),
    );
    await dialog.getByRole("button", { name: "Add offer" }).click();
    await expect(dialog.getByText("Fill this in.")).toHaveCount(2);
    await dialog.getByLabel("Offer").fill("$1,000 in cloud credits");
    await dialog.getByLabel("Link").fill("http://offers.example/plain");
    await dialog.getByRole("button", { name: "Add offer" }).click();
    await expect(dialog.getByText("Enter a full address that starts with https://.")).toBeVisible();
    expect(writes).toEqual([]);
    // Away from the button just pressed, so the page is read at rest and not under the pointer.
    await page.mouse.move(0, 0);
    await expectNoSeriousA11yViolations(page);

    // The backend keeps titles apart; its refusal is said where the title is typed, never as its own text.
    await dialog.getByLabel("Link").fill("https://offers.example/again");
    await dialog.getByRole("button", { name: "Add offer" }).click();
    await expect(dialog.getByText("Another offer already reads the same.")).toBeVisible();
    await expect(page.getByText("text of the backend that must not be shown")).toHaveCount(0);
    expect(writes).toEqual([
      {
        call: "POST /api/solution/admin/offers",
        body: {
          title: "$1,000 in cloud credits",
          url: "https://offers.example/again",
          version: null,
        },
      },
    ]);
  });

  test("an operator changes an offer with the version the form read", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const writes = await answerDecisions(page, offersPath, 200, {
      id: cloudCredits.id,
      title: "$2,000 in cloud credits",
      url: "https://offers.example/cloud-credits",
      solutions: 2,
      version: 1,
      updatedAt: "2026-10-03T07:32:00Z",
    });
    await page.goto("/admin/offers");
    await page
      .getByRole("button", { name: "Actions for $1,000 in cloud credits" })
      .filter({ visible: true })
      .click();
    await page.getByRole("menuitem", { name: "Edit…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Offer")).toHaveValue("$1,000 in cloud credits");
    await dialog.getByLabel("Offer").fill("$2,000 in cloud credits");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("$2,000 in cloud credits saved.")).toBeVisible();
    expect(writes).toEqual([
      {
        call: `PUT /api/solution/admin/offers/${cloudCredits.id}`,
        body: {
          title: "$2,000 in cloud credits",
          url: "https://offers.example/cloud-credits",
          version: 0,
        },
      },
    ]);
  });

  test("an operator chooses the offers of a submitted solution on its record", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await answerOfferList(page);
    const writes = await answerDecisions(
      page,
      `**/api/solution/admin/solutions/${policyChat}/offers`,
      204,
    );
    await page.goto(`/admin/solutions/${policyChat}`);

    const form = page.getByRole("form", { name: "Offers" });
    await form.getByLabel("Offers").fill("cloud");
    await page.getByRole("option", { name: "$1,000 in cloud credits" }).click();
    await expect(
      form.getByRole("button", { name: "Remove $1,000 in cloud credits" }),
    ).toBeVisible();
    // An operator adds to the list from where the offers are chosen.
    await expect(form.getByRole("button", { name: "New offer…" })).toBeVisible();
    await form.getByRole("button", { name: "Save offers" }).click();

    await expect(page.getByText("Offers saved for Policy Chat.")).toBeVisible();
    expect(writes).toEqual([
      {
        call: `PUT /api/solution/admin/solutions/${policyChat}/offers`,
        body: { offerIds: [cloudCredits.id] },
      },
    ]);
  });
});
