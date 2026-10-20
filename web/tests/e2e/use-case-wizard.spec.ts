import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { draftUseCase, draftUseCaseId } from "./stub-wizards.mjs";

const wizardPath = `/workspace/organization/use-cases/${draftUseCaseId}`;
const listPath = "/workspace/organization/use-cases";

type Saved = {
  title: string | null;
  requirements: { statement: string; necessity: string }[];
  closesAt: string | null;
  version: number;
};

/**
 * Answers what the browser writes while a use case is written, as the backend would: each save
 * with the next version, and the sending, after which the stub backend answers the page with a use
 * case that waits for GenAI Fund (stub-wizards.mjs). Returns what it saw.
 */
async function fakeBackend(page: Page, baseURL: string) {
  const saves: Saved[] = [];
  const submits: string[] = [];
  let version = draftUseCase.version;

  await page.route(`**/api/usecase/mine/${draftUseCaseId}`, async (route) => {
    const request = route.request();
    if (request.method() !== "PUT") {
      return route.fallback();
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    const body = request.postDataJSON() as Saved;
    saves.push(body);
    version += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...draftUseCase,
        title: body.title,
        requirements: body.requirements,
        updatedAt: new Date().toISOString(),
        version,
      }),
    });
  });
  await page.route(`**/api/usecase/mine/${draftUseCaseId}/submit`, async (route) => {
    expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
    submits.push(route.request().method());
    await page.context().addCookies([{ name: "STUB_SCENE", value: "review", url: baseURL }]);
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return { saves, submits };
}

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const steps = (page: Page) => page.getByRole("navigation", { name: "Steps of the use case" });

/**
 * Opens a step from the list of steps: the column beside the form, or on a phone the bar above it,
 * whose list is opened first.
 */
async function openStep(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    const bar = steps(page).getByRole("button", { name: /All steps/ });
    await bar.click();
    await expect(bar).toHaveAttribute("aria-expanded", "true");
  }
  await steps(page).getByRole("button", { name, exact: true }).click();
}

test.describe("an organization's use case, written in steps", () => {
  test.use({ locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" });

  test("a member edits a draft, which saves as it changes, leaves it, and sends it", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { saves, submits } = await fakeBackend(page, baseURL!);
    await page.goto(wizardPath);

    // The draft opens on its first step, holding what was stored.
    await expect(heading(page)).toHaveText("The challenge");
    const title = page.getByLabel("Use case title");
    await expect(title).toHaveValue("Invoice matching");
    await expect(page.getByRole("checkbox", { name: "Document Intelligence" })).toBeChecked();
    if (isMobile) {
      await expect(
        steps(page).getByRole("button", { name: /^Step 1 of 5 · The challenge/ }),
      ).toBeVisible();
    } else {
      await expect(
        steps(page).getByRole("button", { name: "The challenge", exact: true }),
      ).toHaveAttribute("aria-current", "step");
    }

    await title.fill("Invoice matching for finance");
    // Saved a moment after the last change, with the version the page read.
    await expect
      .poll(() => saves.at(-1))
      .toMatchObject({
        title: "Invoice matching for finance",
        requirements: [{ statement: "Reads scanned invoices", necessity: "required" }],
        closesAt: "2026-12-31T16:59:00.000Z",
        version: 5,
      });
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // A step opened from the list takes the focus on its heading.
    await openStep(page, isMobile, "Requirements and data");
    await expect(heading(page)).toHaveText("Requirements and data");
    await expect(heading(page)).toBeFocused();
    if (isMobile) {
      const bar = steps(page).getByRole("button", { name: /All steps/ });
      await expect(bar).toHaveText(/Step 3 of 5 · Requirements and data/);
      await expect(bar).toHaveAttribute("aria-expanded", "false");
    }
    await expect(page.getByLabel("Requirement 1")).toHaveValue("Reads scanned invoices");
    await page.getByRole("button", { name: "Add a requirement" }).click();
    await page.getByLabel("Requirement 2").fill("Flags an invoice that matches no order");
    await expect
      .poll(() => saves.at(-1))
      .toMatchObject({
        requirements: [
          { statement: "Reads scanned invoices", necessity: "required" },
          { statement: "Flags an invoice that matches no order", necessity: "required" },
        ],
        version: 6,
      });
    await expectNoSeriousA11yViolations(page);

    // Leaving saves what waits, and the list of the organization's use cases opens.
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(listPath);

    // Opened again, the draft is read from the backend and goes on to its last step.
    await page.goto(wizardPath);
    await expect(page.getByLabel("Use case title")).toHaveValue("Invoice matching");
    await openStep(page, isMobile, "Review and submit");
    await expect(heading(page)).toHaveText("Review and submit");
    await expect(page.getByText("1 requirement: 1 required, 0 optional")).toBeVisible();
    await expect(
      page.getByText("Finance matches invoices to purchase orders by hand."),
    ).toBeVisible();
    const submit = page.getByRole("button", { name: "Send for review" });
    await expect(submit).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "I confirm this information is accurate and can be shown publicly.",
      })
      .click();
    await expectNoSeriousA11yViolations(page);
    const before = saves.length;
    await submit.click();

    await expect(page).toHaveURL(`${wizardPath}/sent`);
    await expect(heading(page)).toHaveText("Sent for review");
    expect(submits).toEqual(["POST"]);
    // Nothing was changed since the draft was opened again, so sending saved nothing first.
    expect(saves).toHaveLength(before);
  });

  test("what the backend would refuse is told at the field and never saved", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const { saves } = await fakeBackend(page, baseURL!);
    await page.goto(wizardPath);
    await openStep(page, isMobile, "Budget and timeline");
    await expect(heading(page)).toHaveText("Budget and timeline");

    // The draft's budget is to be determined; giving amounts is a change that saves.
    await page.getByRole("checkbox", { name: "Budget to be determined" }).click();
    await expect.poll(() => saves.length).toBe(1);
    await expect(page.getByText(/^Saved /)).toBeVisible();

    const minimum = page.getByLabel("Minimum budget (USD)");
    await minimum.fill("-5");
    await expect(minimum).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a whole number, 0 or more.")).toBeVisible();
    await page.getByLabel("Proposals close").fill("2026-01-01");
    await expect(page.getByText("Choose a close time later than now.")).toBeVisible();
    await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
    expect(saves).toHaveLength(1);
    await expectNoSeriousA11yViolations(page);
  });
});
