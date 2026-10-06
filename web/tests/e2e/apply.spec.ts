import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { emptyView, submittedId, tascoQuestions } from "./stub-applications.mjs";

const applyPath = "/programs/insurance-ai-tasco/apply";
const email = "an.tran@example.com";
const shots = process.env.APPLY_SHOTS;

type Call = { call: string; body: unknown };

/**
 * Answers what the browser writes while a person applies, as the backend would, keeping the
 * application, the organization and the solution between calls. Returns the calls it saw.
 */
async function fakeBackend(page: Page) {
  const calls: Call[] = [];
  const view = emptyView(email) as Record<string, unknown> & {
    application: Record<string, unknown> | null;
    organization: Record<string, unknown> | null;
  };
  let version = 0;
  const solution: Record<string, unknown> = {
    id: "5a0b7c1d-0000-4000-8000-000000000010",
    organizationId: "5a0b7c1d-0000-4000-8000-000000000020",
    organizationName: "An Tran",
    slug: "claim-copilot",
    name: "",
    summary: null,
    problemsSolved: null,
    valueProposition: null,
    focusAreas: [],
    industries: [],
    maturity: null,
    deployment: [],
    website: null,
    demoUrl: null,
    traction: null,
    builtWith: [],
    languages: [],
    bestCustomerProfile: null,
    deck: null,
    status: "draft",
    decisionReason: null,
    decisionMessage: null,
    listed: true,
    complete: false,
    submittedAt: null,
    version: 0,
    updatedAt: new Date().toISOString(),
    customerDeployments: [],
  };
  const fulfil = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/proposal/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({ call: `${request.method()} ${path}`, body: request.postDataJSON() });
    if (path.endsWith("/application/organization")) {
      const body = request.postDataJSON();
      view.organization = {
        id: solution.organizationId,
        name: body.name,
        type: body.kind === "individual" ? "independent_builder" : "builder_team",
        country: body.country,
        teamSize: body.kind === "individual" ? "just_me" : body.teamSize,
        approved: false,
      };
      return route.fulfill(fulfil(view));
    }
    if (path.endsWith("/application") && request.method() === "PUT") {
      const body = request.postDataJSON();
      version += 1;
      view.application = {
        id: "3e2d1c0b-0000-4000-8000-000000000030",
        status: "draft",
        contact: body.contact,
        teamBackground: body.teamBackground,
        solutionId: body.solutionId,
        deck: body.deckFileId
          ? { fileId: body.deckFileId, fileName: "claim-copilot-deck.pdf", sizeBytes: 2_400_000 }
          : null,
        builtWith: body.builtWith,
        traction: body.traction,
        answers: body.answers,
        files: {},
        submissions: 0,
        submittedAt: null,
        withdrawnAt: null,
        version,
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(fulfil(view));
    }
    if (path.endsWith("/submit")) {
      view.application = { ...view.application, status: "submitted", submissions: 1 };
      return route.fulfill(fulfil(view));
    }
    return route.fallback();
  });

  await page.route("**/api/solution/mine**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      calls.push({ call: `${request.method()} ${path}`, body: request.postDataJSON() });
    }
    if (request.method() === "POST" && path === "/api/solution/mine") {
      solution.name = request.postDataJSON().name;
      return route.fulfill(fulfil(solution, 201));
    }
    if (request.method() === "PUT") {
      Object.assign(solution, request.postDataJSON(), { version: Number(solution.version) + 1 });
      return route.fulfill(fulfil(solution));
    }
    return route.fulfill(fulfil(solution));
  });

  // An upload: reserved, its bytes sent where the ticket says, then confirmed.
  let uploads = 0;
  await page.route("**/api/storage/uploads**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/confirm")) {
      const id = path.split("/").at(-2);
      return route.fulfill(
        fulfil({
          id,
          fileName: "claim-copilot-deck.pdf",
          mediaType: "application/pdf",
          sizeBytes: 2_400_000,
        }),
      );
    }
    if (request.method() === "POST") {
      uploads += 1;
      const id = `9d8c7b6a-0000-4000-8000-00000000004${uploads}`;
      return route.fulfill(
        fulfil({
          id,
          method: "PUT",
          url: `/api/storage/uploads/${id}/content`,
          headers: {},
          expiresAt: new Date(Date.now() + 900_000).toISOString(),
        }),
      );
    }
    return route.fulfill({ status: 204 });
  });

  return calls;
}

const pdf = {
  name: "deck.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%fake\n"),
};

/** Axe reads the page with the pointer off the buttons: a pressed button's hover colour is not what is checked. */
async function settled(page: Page) {
  await page.mouse.move(0, 0);
  await expectNoSeriousA11yViolations(page);
}

async function shot(page: Page, name: string) {
  if (shots) {
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  }
}

test.describe("apply", () => {
  test.use({ locale: "en-US", timezoneId: "Europe/Paris" });

  test("signing in comes first and returns to the form", async ({ page }) => {
    const visitor = await page.request.get(applyPath, { maxRedirects: 0 });
    expect(visitor.status()).toBe(307);
    expect(visitor.headers()["location"]).toBe(
      "/sign-in?returnTo=%2Fprograms%2Finsurance-ai-tasco%2Fapply",
    );
  });

  test("a person on their own applies in four steps", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const calls = await fakeBackend(page);
    const label = isMobile ? "mobile" : "desktop";
    await page.goto(applyPath);
    await page.waitForLoadState("networkidle");

    // Step 1: what is missing is said beside each field, and the first one takes the focus.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You and your team");
    await expect(page.getByRole("radio", { name: /Individual/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("First name")).toBeFocused();
    await expect(page.getByText("Enter a phone number with its country code.")).toBeVisible();
    await settled(page);
    await shot(page, `apply-1-errors-${label}`);

    await page.getByLabel("First name").fill("An");
    await page.getByLabel("Last name").fill("Tran");
    await page.getByLabel("Phone number").fill("+84 912 345 678");
    await page.getByLabel("Country").selectOption({ label: "Vietnam" });
    await page.getByLabel("LinkedIn profile").fill("https://www.linkedin.com/in/antran");
    await expect(
      page.getByText("Judges see you as An Tran · Individual.", { exact: false }),
    ).toBeVisible();
    await shot(page, `apply-1-${label}`);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: the solution, its deck uploaded at once.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your solution");
    expect(calls[0]).toEqual({
      call: "POST /api/proposal/programs/insurance-ai-tasco/application/organization",
      body: { kind: "individual", name: "An Tran", country: "VN" },
    });
    await page.getByLabel("Solution name").fill("Claim Copilot");
    await page
      .getByLabel("What it does")
      .fill("A chat assistant that tells a driver what is covered.");
    await page
      .getByLabel("Problem it solves")
      .fill("Drivers wait on a hotline after a minor accident.");
    await page.getByLabel("Stage").selectOption({ label: "In pilot" });
    await page.locator("#deck").setInputFiles(pdf);
    await expect(page.getByText("claim-copilot-deck.pdf")).toBeVisible();
    const builtWith = page.getByLabel("Built with");
    await builtWith.fill("OpenAI GPT");
    await builtWith.press("Enter");
    await settled(page);
    await shot(page, `apply-2-${label}`);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: the program's own questions.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("For this program");
    await page.getByLabel("Direction").selectOption("Claiming");
    await page
      .getByLabel("How does your solution address the challenge?")
      .fill("Claims reach a decision without a hotline call.");
    await page.locator(`#question-${tascoQuestions[2].id}`).setInputFiles(pdf);
    await page.getByRole("checkbox", { name: /one hard constraint/ }).check();
    await settled(page);
    await shot(page, `apply-3-${label}`);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: everything once more, then a confirmation before it goes.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review and submit");
    await expect(page.getByText("Claim Copilot").first()).toBeVisible();
    await expect(page.getByText("OpenAI GPT")).toBeVisible();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByText("Confirm the information to submit.")).toBeVisible();
    await page.getByRole("checkbox", { name: "I confirm the information is accurate." }).check();
    await settled(page);
    await shot(page, `apply-4-${label}`);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page).toHaveURL(
      /\/applications\/3e2d1c0b-0000-4000-8000-000000000030\/submitted$/,
    );
    const saved = calls.filter((call) => call.call.startsWith("PUT /api/proposal/")).at(-1);
    expect(saved?.body).toMatchObject({
      contact: {
        firstName: "An",
        lastName: "Tran",
        phone: "+84 912 345 678",
        country: "VN",
        linkedin: "https://www.linkedin.com/in/antran",
      },
      solutionId: "5a0b7c1d-0000-4000-8000-000000000010",
      builtWith: ["OpenAI GPT"],
      answers: {
        [tascoQuestions[0].id]: "Claiming",
        [tascoQuestions[3].id]: "true",
      },
    });
    expect(calls.map((call) => call.call)).toContain(
      "POST /api/proposal/applications/3e2d1c0b-0000-4000-8000-000000000030/submit",
    );
  });

  test("the receipt, My applications and an application, which can be withdrawn", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    const label = isMobile ? "mobile" : "desktop";
    await signInAs(context, "owner", baseURL!);
    await page.goto(`/applications/${submittedId}/submitted`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Application submitted");
    await expect(page.getByText("emailed a copy to", { exact: false })).toBeVisible();
    await expect(page.getByText("You hear back on", { exact: false })).toBeVisible();
    await settled(page);
    await shot(page, `apply-5-receipt-${label}`);

    await page.getByRole("link", { name: "View my application" }).click();
    await expect(page).toHaveURL(`/applications/${submittedId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claim Copilot");
    await expect(page.getByText("pocket-policy-proposal.pdf")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit application" })).toHaveAttribute(
      "href",
      "https://beyondpilot.genaifund.ai/insurance-ai-tasco/apply",
    );
    await settled(page);
    await shot(page, `apply-6-application-${label}`);

    const withdrawn: string[] = [];
    await page.route(`**/api/proposal/applications/${submittedId}/withdraw`, async (route) => {
      withdrawn.push(route.request().method());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.getByRole("button", { name: "Withdraw application" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "Withdraw your application to AI for Insurance Challenge × Tasco?",
    );
    await dialog.getByRole("button", { name: "Keep it" }).click();
    expect(withdrawn).toEqual([]);
    await page.getByRole("button", { name: "Withdraw application" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Withdraw", exact: true })
      .click();
    await expect(page.getByText("Your application was withdrawn.")).toBeVisible();
    expect(withdrawn).toEqual(["POST"]);

    await page.goto("/applications");
    const submitted = page.getByRole("region", { name: "Submitted" });
    await expect(
      submitted.getByRole("link", { name: "AI for Insurance Challenge × Tasco" }),
    ).toBeVisible();
    await expect(submitted.getByText("Claim Copilot · Pocket Policy")).toBeVisible();

    // Each submitted application shows its stages; what is behind it is marked done.
    const open = submitted.getByRole("listitem").filter({ hasText: "Claim Copilot" });
    const openStages = open.getByRole("list", { name: "Where your application stands" });
    await expect(openStages.getByRole("listitem")).toHaveText([
      /^Submitted \(done\)/,
      /^Screening \(to come\)GenAI Fund$/,
      /^Outcome \(to come\)/,
      /^Demo day \(to come\)/,
    ]);
    const released = page
      .getByRole("region", { name: "Past" })
      .getByRole("listitem")
      .filter({ hasText: "Route Copilot" });
    await expect(released.getByText("Shortlisted").first()).toBeVisible();
    await expect(
      released.getByRole("list", { name: "Where your application stands" }).getByRole("listitem"),
    ).toHaveText([
      /^Submitted \(done\)/,
      /^Screening \(done\)GenAI Fund$/,
      /^Outcome \(done\)Shortlisted$/,
      /^Demo day \(to come\)/,
    ]);
    await settled(page);
    await shot(page, `apply-7-mine-${label}`);
  });

  test("My applications starts empty and leads to the programs", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/applications");
    await expect(page.getByText("No applications yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse programs" })).toHaveAttribute(
      "href",
      "/programs",
    );
  });
});
