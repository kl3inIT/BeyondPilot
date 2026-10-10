import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

// Two published use cases of Pocket Policy and what is matched to them (tests/e2e/stub-matching.mjs):
// "Claims triage" asks for three things, "Invoice capture" for one, as most use cases do.
const useCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0011";
const oneNeedUseCaseId = "0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a0021";
const memberPath = `/workspace/organization/use-cases/${useCaseId}/candidates`;
const oneNeedPath = `/workspace/organization/use-cases/${oneNeedUseCaseId}/candidates`;
const adminPath = `/admin/use-cases/${useCaseId}/candidates`;
const candidateId = (number: number) => `c4d1d47e-0000-4000-8000-00000000000${number}`;

// Where the stub backend of this run answers (playwright.config.ts).
const stubOrigin = "http://localhost:3190";

type Candidate = Record<string, unknown> & { solutionName: string };
type Matching = Record<string, unknown> & { candidates: Candidate[] };

/**
 * The state the page read, as the stub answers the account. A request the browser sends is answered
 * by the test with this state changed, the way the backend answers every request with the whole state.
 */
async function matchingAs(request: APIRequestContext, account: "owner" | "operator") {
  const answer = await request.get(`${stubOrigin}/api/matching/use-cases/${useCaseId}`, {
    headers: { Cookie: `BEYONDPILOT_SESSION=${account}` },
  });
  return (await answer.json()) as Matching;
}

/**
 * A use case with a run at work, "Document intake", for one test alone: the stub answers every
 * identifier of this shape with it, so the desktop run and the phone run of a test, which share the
 * stub, each change and listen to their own.
 */
function runningUseCase(testInfo: TestInfo, number: number) {
  const id = `0c8f6f0e-5a0d-4d5e-9f3e-2f4e5a7a1${testInfo.project.name === "mobile" ? 2 : 1}0${number}`;
  const state = `${stubOrigin}/api/matching/use-cases/${id}`;
  const test = `${stubOrigin}/test/matching/use-cases/${id}`;
  const member = { Cookie: "BEYONDPILOT_SESSION=owner" };
  return {
    id,
    path: `/workspace/organization/use-cases/${id}/candidates`,
    /** What the stub answers a member now. */
    read: async (request: APIRequestContext) =>
      (await (await request.get(state, { headers: member })).json()) as Matching,
    /** Replaces what the stub answers, as the backend's state changes; `null` puts its own back. */
    put: async (request: APIRequestContext, next: Matching | null) => {
      expect((await request.put(test, { data: JSON.stringify(next) })).status()).toBe(204);
    },
    /** Sends one event to the pages that listen, as the backend does once a change is kept. */
    push: async (request: APIRequestContext, event: string, data: Record<string, unknown> = {}) => {
      expect((await request.post(`${test}/events`, { data: { event, data } })).status()).toBe(204);
    },
    /** How many pages listen to the stream now. */
    listeners: async (request: APIRequestContext) =>
      ((await (await request.get(`${test}/events`)).json()) as { open: number }).open,
    /**
     * Lets the browser reach the stub for the state and for the stream, as it reaches the backend
     * through the reverse proxy. The stream is a real one: the request goes on to the stub, which
     * keeps it open.
     */
    connect: async (page: Page) => {
      await page.route(`**/api/matching/use-cases/${id}`, (route) =>
        route.continue({ url: state }),
      );
      await page.route(`**/api/matching/use-cases/${id}/events`, (route) =>
        route.continue({ url: `${state}/events` }),
      );
    },
  };
}

/** The state with one solution changed. */
function withCandidate(state: Matching, name: string, change: Record<string, unknown>): Matching {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.solutionName === name ? { ...candidate, ...change } : candidate,
    ),
  };
}

/** Lets the browser read a solution's deck from the stub, as it reads it from the backend. */
async function serveDecks(page: Page) {
  await page.route("**/api/solution/solutions/*/deck", (route) =>
    route.continue({ url: `${stubOrigin}${new URL(route.request().url()).pathname}` }),
  );
}

/**
 * Keeps the member's page as a picture attached to the test: the product owner reads these instead of
 * a member's session (CI uploads them as `matching-pictures-*`). The whole page, or what the window
 * shows when a sheet or a dialog lies over it: an overlay covers the window, not the page.
 */
async function picture(page: Page, testInfo: TestInfo, name: string, whole = true) {
  const file = `member-${name}-${testInfo.project.name}.png`;
  const path = testInfo.outputPath(file);
  await page.screenshot({ path, fullPage: whole });
  await testInfo.attach(file, { path, contentType: "image/png" });
}

/** The sheet a deck opens in; the panel of a phone is a dialog too, and says "deck, page" in small letters. */
const deckSheet = (page: Page) => page.getByRole("dialog").filter({ hasText: /Deck, page \d/ });
/** The line under a solution's name that counts what it meets. */
const counts = (page: Page, name: string) =>
  row(page, name).locator('[data-slot="matching-counts"]');
const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const rowName = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
/** The one line of the vendor's words on a row, and the chip that says where they come from. */
const rowQuote = (page: Page, name: string) =>
  row(page, name).locator('[data-slot="matching-row-quote"]');
const rowSource = (page: Page, name: string) =>
  row(page, name).locator('[data-slot="matching-source"]');
/** The tick that says code found a quote in its source word for word. */
const foundTick = '[data-slot="matching-found"]';
/** The header of the last group, which folds: its name and how many it holds. */
const lastGroupHeader = (page: Page) =>
  page.getByRole("button", { name: /^Right technology, less proof\s*\d+$/ });

test.describe("solutions matched to a use case", () => {
  test.use({ locale: "en-US" });

  test("a member reads the groups and one solution in full", async ({
    page,
    context,
    baseURL,
    isMobile,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims triage");
    const pages = page.getByRole("navigation", { name: "Pages of this use case" });
    await expect(pages.getByRole("link", { name: "Matched solutions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pages.getByRole("link", { name: "Brief" })).toHaveAttribute(
      "href",
      `/workspace/organization/use-cases/${useCaseId}`,
    );

    // A use case that asks for several things says what the solutions meet together, in words.
    await expect(page.getByText("Together they meet 2 of the 3 requirements")).toBeVisible();
    await expect(
      page.getByText(
        "No solution on BeyondPilot shows evidence for: Routes a claim to the right approver",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "AI picked these from each vendor's public material; check before you decide.",
      ),
    ).toHaveCount(1);
    // What the AI put in no group is not shown.
    await expect(page.getByText("OmniShelf")).toHaveCount(0);

    // Each group is a named region under a second-level heading, with what it means printed under it.
    for (const [name, about] of [
      ["Strong fit", "They show they do it."],
      [
        "Experience in your industry",
        "Similar work in your industry; part of the requirement shown.",
      ],
      ["Right technology, less proof", "Right technology; part of the requirement shown."],
      ["Not reviewed yet", "AI reads these in the next run."],
    ]) {
      await expect(group(page, name).getByRole("heading", { level: 2 })).toContainText(name);
      await expect(group(page, name).getByText(about)).toBeVisible();
    }

    // A member has a number of runs a day, and none of the operators' actions.
    await expect(page.getByText("2 runs left today")).toBeVisible();
    await expect(page.getByRole("button", { name: "Look for new solutions" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);

    // A row counts, over the three capabilities asked for, what the solution meets, meets in part and
    // has no evidence for; then one line of the vendor's words for the must-have, with where they come
    // from, and where the solution is from. The AI's sentence is in the panel.
    const staple = row(page, "Staple AI");
    await expect(counts(page, "Staple AI")).toHaveText("1 met · 1 partly · 1 no evidence");
    await expect(counts(page, "Sentosa Finance")).toHaveText("1 met · 1 partly · 1 no evidence");
    await expect(rowQuote(page, "Staple AI").locator("q")).toHaveText(
      "extracts and verifies the content",
    );
    // A web page is named by its host, a customer case by its number; the chip is not a control.
    await expect(rowSource(page, "Staple AI")).toHaveText("staple.ai");
    await expect(rowSource(page, "Sentosa Finance")).toHaveText("Customer case 1");
    await expect(staple.getByRole("link")).toHaveCount(0);
    await expect(staple.locator("img[src^='http']")).toHaveCount(0);
    await expect(staple.getByText("It reads claim documents in production today.")).toHaveCount(0);
    await expect(staple.getByText("Singapore · In production")).toBeVisible();
    await expect(staple.getByText("Website could not be read")).toBeVisible();
    await expect(rowQuote(page, "Kira Claims")).toHaveCount(0);
    await expect(staple.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    // A solution an operator added by hand carries no mark of its own: every solution here is on BeyondPilot.
    await expect(row(page, "Kira Claims").getByText("Added by GenAI Fund")).toHaveCount(0);
    // What the AI has not read counts nothing, and a solution whose sources were all read has no note.
    await expect(counts(page, "Kira Claims")).toHaveCount(0);
    await expect(row(page, "Sentosa Finance").getByText(/could not be read/)).toHaveCount(0);
    await picture(page, testInfo, "list");

    // What the run did stays behind one line: its stages, without how many solutions were read (that
    // counts those the list does not show a member), the model or how long a stage took.
    await expect(page.getByRole("list", { name: "How AI found these" })).toHaveCount(0);
    await page.getByRole("button", { name: "How AI found these" }).click();
    await expect(
      page.getByRole("list", { name: "How AI found these" }).getByRole("listitem"),
    ).toHaveText([
      "Read the brief: 3 requirements",
      "Searched the solutions on BeyondPilot",
      "Read the closest ones in full",
      "3 match",
    ]);
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "how-ai-found");

    // The last group shows its header alone until it is opened.
    await expect(rowName(page, "Docbase")).toHaveCount(0);
    await expect(lastGroupHeader(page)).toHaveAttribute("aria-expanded", "false");
    await lastGroupHeader(page).click();
    await expect(rowName(page, "Docbase")).toBeVisible();
    // A count of zero is left out.
    await expect(counts(page, "Docbase")).toHaveText("1 partly · 2 no evidence");
    // A web page whose address is not kept is named as the website.
    await expect(rowSource(page, "Docbase")).toHaveText("Website");

    // Beside the list from 1280px; in a sheet that opens when a row is chosen below that.
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();
    await expect(panel.getByText("Singapore · In production")).toBeVisible();
    await expect(panel.getByRole("link", { name: "View solution profile" })).toHaveAttribute(
      "href",
      "/solutions/staple-ai",
    );
    // The group is said by the list, not again by the panel.
    await expect(panel.getByText("Strong fit", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("AI summary", { exact: true })).toBeVisible();
    await expect(panel.getByText("It reads claim documents in production today.")).toBeVisible();
    await expect(panel.getByText("Website could not be read")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Open the deck" })).toHaveCount(0);

    // Each requirement in full, with the verdict in words, the AI's reason and the vendor's words.
    await expect(panel.getByRole("heading", { level: 3, name: "Evidence" })).toBeVisible();
    await expect(
      panel.getByText("Reads claim forms and invoices and takes out their fields"),
    ).toBeVisible();
    await expect(panel.getByText("Must have", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Met", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("Partly met", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("No evidence", { exact: true })).toHaveCount(1);
    await expect(panel.getByText("It flags, it does not check rules.")).toBeVisible();
    await expect(panel.getByText("flags unusual invoices")).toBeVisible();
    // Where the words come from is something to open: the deck in the app, the web page at its address.
    // Words code found there word for word say so, with a tick: that they are in the vendor's material.
    const inDeck = panel.getByRole("button", { name: "Found in their deck, page 2" });
    await expect(inDeck.locator(foundTick)).toHaveCount(1);
    await expect(
      panel.getByRole("link", { name: "Found on their website · staple.ai" }).locator(foundTick),
    ).toHaveCount(1);
    await expect(panel.getByText(/^From their (deck|website)/)).toHaveCount(0);
    // On a phone the panel is a sheet over the window.
    await picture(page, testInfo, "panel", !isMobile);

    // The conditions of delivery wait behind a disclosure that says how many there are.
    await expect(
      panel.getByRole("heading", { level: 3, name: "Ask the vendor about these" }),
    ).toBeVisible();
    await expect(panel.getByText("SAP connector available")).toHaveCount(0);
    await panel.getByRole("button", { name: "1 delivery condition to ask about" }).click();
    await expect(panel.getByText("SAP connector available")).toBeVisible();
    // The one line at the top of the list says the AI read the vendors' own material; it is not said again.
    await expect(panel.getByText(/nobody has checked it/)).toHaveCount(0);
    // Words code did not find carry no mark: the line says where the AI read them, as before.
    const profile = panel.getByRole("link", { name: "From their BeyondPilot profile" });
    await expect(profile).toHaveAttribute("href", "/solutions/staple-ai");
    await expect(profile.locator(foundTick)).toHaveCount(0);
    await expect(panel.getByText("Found in their profile")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Not a fit…" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await expect(panel.getByRole("button", { name: "Previous solution" })).toBeDisabled();
    await panel.getByRole("button", { name: "Next solution" }).click();
    await expect(panel.getByRole("heading", { name: "Sentosa Finance" })).toBeVisible();
    await expect(panel.getByText("Indonesia · At scale")).toBeVisible();
    await expect(panel.getByText("An insurer uses it for invoices.")).toBeVisible();
    await expect(panel.getByText("Experience in your industry", { exact: true })).toHaveCount(0);
    // Words that are only close to the vendor's say so, before the source the AI named.
    await expect(panel.getByText("Close to their words")).toHaveCount(1);
    const nearly = panel.getByRole("button", { name: "From their deck, page 3" });
    await expect(nearly.locator(foundTick)).toHaveCount(0);
    await expect(
      panel.getByRole("link", { name: "Found in their customer case 1" }).locator(foundTick),
    ).toHaveCount(1);
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "found-and-close", !isMobile);
  });

  test("a member says whether the AI put a solution in the right group", async ({
    page,
    context,
    baseURL,
    request,
    isMobile,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const sent: Record<string, unknown>[] = [];
    await page.route("**/api/matching/candidates/*/feedback", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      expect(new URL(route.request().url()).pathname).toBe(
        `/api/matching/candidates/${candidateId(1)}/feedback`,
      );
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sent.push(body);
      // The backend answers the whole state, with the reader's answer on the solution.
      await route.fulfill({
        json: withCandidate(state, "Staple AI", {
          feedback: {
            agrees: body.agrees,
            expectedBucket: body.expectedBucket ?? null,
            requirements: body.requirements ?? [],
            note: body.note ?? null,
            createdAt: "2026-10-10T03:00:00Z",
          },
        }),
      });
    });
    await page.goto(memberPath);
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();

    // One question, with two answers. Yes is one press, and the panel says it back.
    const question = panel.getByRole("region", { name: "Is this the right group?" });
    await expect(question.getByText("Is this the right group?")).toBeVisible();
    await question.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(question.getByText("You agreed.")).toBeVisible();
    expect(sent).toEqual([{ agrees: true }]);
    await expect(question.getByRole("button", { name: "Yes", exact: true })).toHaveCount(0);
    // A member reads their own answer and no count of anyone else's.
    await expect(question.getByText(/answers?,/)).toHaveCount(0);

    // Change asks again. No opens the groups it may belong in, the AI's own left out, and what the AI
    // got wrong; nothing is sent without a group.
    await question.getByRole("button", { name: "Change" }).click();
    await question.getByRole("button", { name: "No", exact: true }).click();
    const where = question.getByRole("group", { name: "Where does it belong?" });
    await expect(where.getByRole("button")).toHaveText([
      "Experience in your industry",
      "Right technology, less proof",
      "Not a fit",
    ]);
    const send = question.getByRole("button", { name: "Send" });
    await expect(send).toBeDisabled();
    await where.getByRole("button", { name: "Experience in your industry" }).click();
    const which = question.getByRole("group", {
      name: "Which requirement did the AI get wrong? (optional)",
    });
    await expect(which.getByRole("checkbox")).toHaveCount(3);
    await which.getByRole("checkbox", { name: "Check rules" }).click();
    await question.getByRole("textbox", { name: "Note (optional)" }).fill("Invoices only, so far.");
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "feedback", !isMobile);
    await send.click();

    await expect(question.getByText("You said: Experience in your industry.")).toBeVisible();
    expect(sent[1]).toEqual({
      agrees: false,
      expectedBucket: "industry",
      requirements: [2],
      note: "Invoices only, so far.",
    });
    // Nothing moved: the solution is where the AI put it. (On a phone the sheet covers the list.)
    if (!isMobile) {
      await expect(
        group(page, "Strong fit").getByRole("button", { name: "Staple AI", exact: true }),
      ).toHaveCount(1);
    }
    await expectNoSeriousA11yViolations(page);

    // Cancel leaves the answer as it was.
    await question.getByRole("button", { name: "Change" }).click();
    await question.getByRole("button", { name: "No", exact: true }).click();
    await question.getByRole("button", { name: "Cancel" }).click();
    await expect(question.getByText("You said: Experience in your industry.")).toBeVisible();
    expect(sent).toHaveLength(2);

    // What the AI has not read has no group to ask about.
    if (isMobile) {
      await panel.getByRole("button", { name: "Close" }).click();
    }
    await rowName(page, "Kira Claims").click();
    await expect(panel.getByRole("heading", { level: 2, name: "Kira Claims" })).toBeVisible();
    await expect(panel.getByRole("region", { name: "Is this the right group?" })).toHaveCount(0);
  });

  test("the keys of an open solution step, save and ask why, and stand back under the deck", async ({
    page,
    context,
    baseURL,
    request,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await serveDecks(page);
    const state = await matchingAs(request, "owner");
    const asked: string[] = [];
    await page.route("**/api/matching/candidates/**", async (route) => {
      asked.push(new URL(route.request().url()).pathname.split("/").at(-1)!);
      await route.fulfill({ json: withCandidate(state, "Staple AI", { decision: "shortlisted" }) });
    });
    await page.goto(memberPath);
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog").filter({ hasNotText: /Deck, page \d/ })
      : page.getByRole("complementary", { name: "The solution you picked" });
    const open = (name: string) => panel.getByRole("heading", { level: 2, name });
    await expect(open("Staple AI")).toBeVisible();

    // The keys are said behind a click, never in a tooltip, and to assistive technology.
    const shortcuts = panel.getByRole("button", { name: "Keyboard shortcuts" });
    await shortcuts.click();
    await expect(page.getByText("Next solution (→)")).toBeVisible();
    await expect(page.getByText("Save (S)")).toBeVisible();
    await shortcuts.click();
    await expect(page.getByText("Save (S)")).toHaveCount(0);
    const next = panel.getByRole("button", { name: "Next solution" });
    await expect(next).toHaveAttribute("title", "Next solution");
    await expect(next).toHaveAttribute("aria-keyshortcuts", "ArrowRight");
    await expect(panel.getByRole("button", { name: "Previous solution" })).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowLeft",
    );
    const save = panel.getByRole("button", { name: "Save", exact: true });
    await expect(save).not.toHaveAttribute("title");
    await expect(save).toHaveAttribute("aria-keyshortcuts", "S");
    await expect(panel.getByRole("button", { name: "Not a fit…" })).toHaveAttribute(
      "aria-keyshortcuts",
      "N",
    );

    // The arrows step through the solutions on the screen.
    await page.keyboard.press("ArrowRight");
    await expect(open("Sentosa Finance")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(open("Staple AI")).toBeVisible();
    // At the first solution there is none before it.
    await page.keyboard.press("ArrowLeft");
    await expect(open("Staple AI")).toBeVisible();

    // A key held with a modifier is the browser's or the reader's own.
    await page.keyboard.press("Shift+S");
    await page.keyboard.press("Alt+n");
    expect(asked).toEqual([]);
    // S saves.
    await page.keyboard.press("s");
    await expect(page.getByText("Staple AI is saved.")).toBeVisible();
    expect(asked).toEqual(["shortlist"]);

    // Under the deck's sheet the keys do nothing to the solution.
    await panel.getByRole("button", { name: "Found in their deck, page 2" }).click();
    const deck = deckSheet(page);
    await expect(deck.getByText("Deck, page 2 of 3")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("s");
    await page.keyboard.press("n");
    await expect(deck.getByText("Deck, page 2 of 3")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(deck).toHaveCount(0);
    await expect(open("Staple AI")).toBeVisible();
    await expect(page.getByRole("region", { name: "Why is Staple AI not a fit?" })).toHaveCount(0);
    expect(asked).toEqual(["shortlist"]);

    // A letter typed in a field is a letter.
    const question = panel.getByRole("region", { name: "Is this the right group?" });
    await question.getByRole("button", { name: "No", exact: true }).click();
    const note = question.getByRole("textbox", { name: "Note (optional)" });
    await note.pressSequentially("sn");
    await expect(note).toHaveValue("sn");
    await note.press("ArrowLeft");
    await expect(open("Staple AI")).toBeVisible();
    expect(asked).toEqual(["shortlist"]);
    await question.getByRole("button", { name: "Cancel" }).click();

    // N asks why the solution is not a fit, in the place of its row.
    await page.keyboard.press("n");
    await expect(page.getByRole("region", { name: "Why is Staple AI not a fit?" })).toBeVisible();
  });

  test("an operator reads how many people answered about a group", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(adminPath);
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();
    const question = panel.getByRole("region", { name: "Is this the right group?" });
    await expect(question.getByText("3 answers, 1 disagrees")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    // Nobody answered about the next one, so nothing is counted there.
    await panel.getByRole("button", { name: "Next solution" }).click();
    await expect(panel.getByRole("heading", { level: 2, name: "Sentosa Finance" })).toBeVisible();
    await expect(question.getByText("Is this the right group?")).toBeVisible();
    await expect(question.getByText(/answers?,/)).toHaveCount(0);

    // An operator reads, behind the same line as a member, how long each stage took and the model.
    if (isMobile) {
      await panel.getByRole("button", { name: "Close" }).click();
    }
    await page.getByRole("button", { name: "How AI found these" }).click();
    await expect(
      page.getByRole("list", { name: "How AI found these" }).getByRole("listitem"),
    ).toHaveText([
      /^Read the brief: 3 requirements\s*4 sec$/,
      /^Searched the solutions on BeyondPilot\s*1 sec$/,
      /^Read 6 solutions closely\s*claude-sonnet-4-5 · 3\.2 min$/,
      "3 match",
    ]);
  });

  test("a quote opens where it stands: the deck at its page, the website at its address", async ({
    page,
    context,
    baseURL,
    isMobile,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    await serveDecks(page);
    await page.goto(memberPath);
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();

    // The page of the website the words come from, in a new tab, named by its host.
    const website = panel.getByRole("link", { name: "Found on their website · staple.ai" });
    await expect(website).toHaveAttribute("href", "https://www.staple.ai/platform");
    await expect(website).toHaveAttribute("target", "_blank");
    await expect(website).toHaveAttribute("rel", "noopener noreferrer");

    // The deck opens inside the app, at the page, with the words highlighted in the page's own text:
    // they run over a line end there, so two runs of text are marked.
    const opener = panel.getByRole("button", { name: "Found in their deck, page 2" });
    await opener.click();
    const deck = deckSheet(page);
    await expect(deck.getByRole("heading", { name: "Staple AI" })).toBeVisible();
    await expect(deck.getByText("Deck, page 2 of 3")).toBeVisible();
    const marks = deck.locator('mark[data-slot="deck-quote"]');
    await expect(marks).toHaveCount(2);
    // A reader who does not see the highlight is told where the quote begins and ends.
    await expect(marks.first()).toHaveText("Start of the quote: flags unusual");
    await expect(marks.last()).toHaveText("invoices End of the quote.");
    await expect(deck.getByText("The quote is highlighted on this page")).toBeVisible();
    await expect(deck.locator('[data-slot="deck-page"]')).toHaveAttribute(
      "data-quote",
      "highlighted",
    );
    // The focus is inside the sheet.
    await expect(deck.locator(":focus")).toHaveCount(1);
    const file = deck.getByRole("link", { name: "Open the file" });
    await expect(file).toHaveAttribute("href", "/api/solution/solutions/staple-ai/deck#page=2");
    await expect(file).toHaveAttribute("target", "_blank");
    await expect(file).toHaveAttribute("rel", "noopener noreferrer");
    await expect(deck.getByRole("button", { name: "Previous page" })).toBeEnabled();
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "deck", false);

    // The pages around it, and the way back to the quote.
    await deck.getByRole("button", { name: "Next page" }).click();
    await expect(deck.getByText("Deck, page 3 of 3")).toBeVisible();
    await expect(deck.getByRole("button", { name: "Next page" })).toBeDisabled();
    await expect(marks).toHaveCount(0);
    await expect(deck.getByText("The quote is highlighted on this page")).toHaveCount(0);
    await expect(file).toHaveAttribute("href", "/api/solution/solutions/staple-ai/deck#page=3");
    await deck.getByRole("button", { name: "Back to the quote, page 2" }).click();
    await expect(deck.getByText("Deck, page 2 of 3")).toBeVisible();
    await expect(marks).toHaveCount(2);

    // Closing gives the focus back to the control that opened the deck.
    await page.keyboard.press("Escape");
    await expect(deck).toHaveCount(0);
    await expect(opener).toBeFocused();

    // A slide that is a picture has no text to mark: the page is framed whole and the quote is printed
    // under the title. Nothing is highlighted that was not found.
    await panel.getByRole("button", { name: "Next solution" }).click();
    await expect(panel.getByRole("heading", { level: 2, name: "Sentosa Finance" })).toBeVisible();
    // A customer case is read on the solution's page.
    await expect(
      panel.getByRole("link", { name: "Found in their customer case 1" }),
    ).toHaveAttribute("href", "/solutions/sentosa-finance");
    await panel.getByRole("button", { name: "From their deck, page 3" }).click();
    await expect(deck.getByRole("heading", { name: "Sentosa Finance" })).toBeVisible();
    await expect(deck.getByText("Deck, page 3 of 3")).toBeVisible();
    await expect(deck.getByText("The quote is on this page")).toBeVisible();
    await expect(deck.locator("blockquote")).toHaveText("Double payment and missing invoices");
    await expect(deck.locator('[data-slot="deck-page"]')).toHaveAttribute("data-quote", "framed");
    await expect(marks).toHaveCount(0);
    await expect(deck.getByText("The quote is highlighted on this page")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "deck-picture-page", false);
    await deck.getByRole("button", { name: "Close" }).click();
    await expect(deck).toHaveCount(0);

    // A solution its owners keep out of the directory has no page and no deck to open: the source of
    // its words stays plain text.
    if (isMobile) {
      await panel.getByRole("button", { name: "Close" }).click();
    }
    await lastGroupHeader(page).click();
    await rowName(page, "Docbase").click();
    await expect(panel.getByRole("heading", { level: 2, name: "Docbase" })).toBeVisible();
    await expect(panel.getByText("Found on their website", { exact: true })).toBeVisible();
    await expect(panel.getByRole("link")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /their (deck|website)/ })).toHaveCount(0);
  });

  test("a deck that was not read is there to open, and one that cannot be opened says so", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    // The file is gone from the store: the backend answers that there is no such deck.
    let asked = 0;
    await page.route("**/api/solution/solutions/*/deck", async (route) => {
      asked += 1;
      await route.fulfill({
        status: 404,
        contentType: "application/problem+json",
        body: JSON.stringify({ code: "SOLUTION_NOT_FOUND" }),
      });
    });
    await page.goto(oneNeedPath);
    if (isMobile) {
      await rowName(page, "Staple AI").click();
    }
    const panel = isMobile
      ? page.getByRole("dialog")
      : page.getByRole("complementary", { name: "The solution you picked" });
    await expect(panel.getByRole("heading", { level: 2, name: "Staple AI" })).toBeVisible();

    // The one requirement is at the top of the page, so the panel does not print it again, and the
    // AI's reason for it stands in the place of the summary.
    await expect(panel.getByRole("heading", { level: 3, name: "Evidence" })).toBeVisible();
    await expect(
      panel.getByText("Reads claim forms and invoices and takes out their fields"),
    ).toHaveCount(0);
    await expect(panel.getByText("AI summary", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("It reads invoices in production today.")).toHaveCount(0);
    await expect(panel.getByText("It reads documents and takes out their fields.")).toBeVisible();
    await expect(panel.getByText("Met", { exact: true })).toHaveCount(1);

    // The note is short, and the deck the AI could not read is there for the reader to open.
    await expect(panel.getByText("Deck could not be read")).toBeVisible();
    await panel.getByRole("button", { name: "Open the deck" }).click();
    const deck = deckSheet(page);
    await expect(deck.getByText("Deck, page 1", { exact: true })).toBeVisible();
    const failed = deck.getByRole("alert");
    await expect(failed.getByText("The deck could not be opened")).toBeVisible();
    await expect(failed.getByRole("link", { name: "Open the file" })).toHaveAttribute(
      "href",
      "/api/solution/solutions/staple-ai/deck#page=1",
    );
    await expect(deck.getByRole("button", { name: "Next page" })).toHaveCount(0);
    expect(asked).toBeGreaterThan(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a use case that asks for one thing reads as one sentence, and its last group folds", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(oneNeedPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Invoice capture");
    await expect(page.getByText("8 solutions match. 1 meets the key requirement.")).toBeVisible();
    await expect(
      page.getByText("Key requirement: Reads claim forms and invoices and takes out their fields"),
    ).toBeVisible();
    // Nothing to filter by, and no line on what they meet together.
    await expect(page.getByRole("group", { name: "Filter by requirement" })).toHaveCount(0);
    await expect(page.getByText(/^Together they meet/)).toHaveCount(0);

    // The first two groups show every row.
    await expect(group(page, "Strong fit").getByRole("listitem")).toHaveCount(1);
    await expect(group(page, "Experience in your industry").getByRole("listitem")).toHaveCount(1);
    const staple = row(page, "Staple AI");
    await expect(rowQuote(page, "Staple AI").locator("q")).toHaveText(
      "extracts and verifies the content",
    );
    await expect(staple.getByText("It reads invoices in production today.")).toHaveCount(0);
    await expect(staple.getByText("Deck could not be read")).toBeVisible();
    // With one capability the row says its status in words, in every group.
    await expect(staple.getByText("Met", { exact: true })).toBeVisible();
    await expect(
      row(page, "Sentosa Finance").getByText("Partly met", { exact: true }),
    ).toBeVisible();
    await expect(counts(page, "Staple AI")).toHaveCount(0);

    // The last group: its header alone, then five rows, then all six.
    const last = group(page, "Right technology, less proof");
    await expect(last.getByRole("heading", { level: 2 })).toContainText("6");
    await expect(last.getByText("Right technology; part of the requirement shown.")).toBeVisible();
    await expect(last.getByRole("listitem")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    await lastGroupHeader(page).click();
    await expect(lastGroupHeader(page)).toHaveAttribute("aria-expanded", "true");
    await expect(last.getByRole("listitem")).toHaveCount(5);
    await last.getByRole("button", { name: "Show 1 more" }).click();
    await expect(last.getByRole("listitem")).toHaveCount(6);
    await expect(last.getByRole("button", { name: "Show fewer" })).toBeVisible();
    // A solution with no quote shows the AI's sentence, as before, and no source.
    await expect(row(page, "Inkstone").getByText("Built on document intelligence.")).toBeVisible();
    await expect(rowQuote(page, "Inkstone")).toHaveCount(0);
    await expect(rowSource(page, "Inkstone")).toHaveCount(0);
    await expect(rowQuote(page, "Ledgerly").locator("q")).toHaveText(
      "extracting data from PDFs and images",
    );
    await expectNoSeriousA11yViolations(page);
  });

  test("a requirement narrows the list, and one nobody shows evidence for says so", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto(memberPath);

    const filter = page.getByRole("group", { name: "Filter by requirement" });
    await expect(filter.getByRole("button", { name: "Any", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await filter.getByRole("button", { name: "Check rules 2" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toBeVisible();
    await expect(group(page, "Right technology, less proof")).toHaveCount(0);

    await filter.getByRole("button", { name: "Approval flow 0" }).click();
    await expect(
      page.getByText("No solution here shows evidence for: Routes a claim to the right approver"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show all solutions" }).click();
    await expect(group(page, "Right technology, less proof")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("a member saves a solution", async ({ page, context, baseURL, request }) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const asked: string[] = [];
    await page.route("**/api/matching/candidates/*/shortlist", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      asked.push(new URL(route.request().url()).pathname);
      await route.fulfill({
        json: withCandidate(state, "Staple AI", { decision: "shortlisted" }),
      });
    });
    await page.goto(memberPath);

    await page.getByRole("tab", { name: "Saved 0" }).click();
    await expect(page.getByText("Save the solutions you want to talk to.")).toBeVisible();
    await page.getByRole("tab", { name: "Matches 4" }).click();

    const staple = row(page, "Staple AI");
    await staple.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Staple AI is saved.")).toBeVisible();
    expect(asked).toEqual([`/api/matching/candidates/${candidateId(1)}/shortlist`]);
    await expect(staple.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("tab", { name: "Saved 1" }).click();
    await expect(rowName(page, "Staple AI")).toBeVisible();
    await expect(rowName(page, "Sentosa Finance")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a member removes a solution with a reason, and the Removed tab says who and why", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const sent: unknown[] = [];
    await page.route("**/api/matching/candidates/*/remove", async (route) => {
      expect(route.request().headers()["x-beyondpilot-csrf"]).toBe("1");
      expect(new URL(route.request().url()).pathname).toBe(
        `/api/matching/candidates/${candidateId(3)}/remove`,
      );
      sent.push(route.request().postDataJSON());
      await route.fulfill({
        json: withCandidate(state, "Docbase", {
          decision: "removed",
          removedReason: "wrong_industry_or_size",
          removedNote: "too small for us",
          removedBy: "Minh Trần",
          removedByOperator: false,
          removedAt: "2026-10-09T02:00:00Z",
        }),
      });
    });
    await page.goto(memberPath);

    // The row folds in place into the reasons; nothing is removed without one, and the note is optional.
    await lastGroupHeader(page).click();
    await page.getByRole("button", { name: "More for Docbase" }).click();
    await page.getByRole("menuitem", { name: "Not a fit…" }).click();
    const picker = page.getByRole("region", { name: "Why is Docbase not a fit?" });
    const confirm = picker.getByRole("button", { name: "Remove", exact: true });
    await expect(confirm).toBeDisabled();
    await picker.getByRole("button", { name: "Wrong industry or company size" }).click();
    await expect(confirm).toBeEnabled();
    await expect(picker.getByText("We won't suggest it for this use case again.")).toBeVisible();
    await picker.getByRole("textbox", { name: "Add a note (optional)" }).fill("too small for us");
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "reasons");
    await confirm.click();

    await expect(page.getByText("Docbase removed · Wrong industry or company size")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    expect(sent).toEqual([{ reason: "wrong_industry_or_size", note: "too small for us" }]);
    await expect(rowName(page, "Docbase")).toHaveCount(0);

    // The Removed tab is the chosen one, alone, and its list has no panel beside it.
    await page.getByRole("tab", { name: "Removed 3" }).click();
    await expect(page.getByRole("tab", { name: "Removed 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { selected: true })).toHaveCount(1);
    await expect(page.getByRole("complementary", { name: "The solution you picked" })).toHaveCount(
      0,
    );
    const removed = page.getByRole("tabpanel").getByRole("listitem");
    const docbase = removed.filter({ hasText: "Docbase" });
    await expect(
      docbase.getByText("Wrong industry or company size · too small for us"),
    ).toBeVisible();
    await expect(docbase.getByText(/^Removed by Minh Trần · /)).toBeVisible();
    await expect(docbase.getByRole("button", { name: "Restore" })).toBeVisible();

    // What GenAI Fund removed, a member reads and cannot restore.
    const fintelite = removed.filter({ hasText: "Fintelite" });
    await expect(fintelite.getByText("Does not solve this problem")).toBeVisible();
    await expect(fintelite.getByText(/^Removed by GenAI Fund · /)).toBeVisible();
    await expect(
      fintelite.getByText("GenAI Fund removed it, so only GenAI Fund can restore it."),
    ).toBeVisible();
    await expect(fintelite.getByRole("button", { name: "Restore" })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a member is asked before a run, which is one of the few the day allows", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    await signInAs(context, "owner", baseURL!);
    const state = await matchingAs(request, "owner");
    const sent: unknown[] = [];
    await page.route("**/api/matching/use-cases/*/runs", async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ json: state });
    });
    await page.goto(memberPath);

    await page.getByRole("button", { name: "Look for new solutions" }).click();
    const asking = page.getByRole("alertdialog", { name: "Look for solutions now?" });
    await expect(asking.getByText("This uses 1 of your 2 runs left today.")).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "run-confirmation", false);
    expect(sent).toEqual([]);

    await asking.getByRole("button", { name: "Look for new solutions" }).click();
    await expect(page.getByText("Looking for solutions.")).toBeVisible();
    expect(sent).toEqual([{ judgeAll: false }]);
    await expect(asking).toHaveCount(0);
  });

  test("an operator looks again without being asked, and finds the rest under More", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const state = await matchingAs(request, "operator");
    const sent: { runs: unknown[]; added?: unknown; search?: string | null } = { runs: [] };
    await page.route("**/api/matching/use-cases/*/runs", async (route) => {
      sent.runs.push(route.request().postDataJSON());
      await route.fulfill({ json: state });
    });
    await page.route("**/api/matching/use-cases/*/candidates", async (route) => {
      sent.added = route.request().postDataJSON();
      await route.fulfill({ json: state });
    });
    await page.route(/\/api\/solution\/admin\/solutions\?/, async (route) => {
      sent.search = new URL(route.request().url()).searchParams.get("status");
      const solution = (id: string, name: string) => ({
        id,
        name,
        slug: name.toLowerCase(),
        organizationName: `${name} Pte`,
        status: "approved",
        listed: true,
        industries: ["insurance"],
        maturity: "pilot",
        deploymentsAwaitingReview: 0,
      });
      await route.fulfill({
        json: {
          items: [
            solution("50101000-0000-4000-8000-000000000001", "Staple AI"),
            solution("50101000-0000-4000-8000-000000000099", "Newcomer"),
          ],
          page: 1,
          pageSize: 25,
          total: 2,
          awaitingReview: 0,
          deploymentsAwaitingReview: 0,
        },
      });
    });
    await page.goto(adminPath);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claims triage");
    await expect(page.getByText("Pocket Policy", { exact: true })).toBeVisible();
    // An operator reads how many solutions the AI read and with which model, and has no number of runs.
    await expect(
      page.getByText(/^Updated .+ · AI read 6 solutions closely · model claude-sonnet-4-5$/),
    ).toBeVisible();
    await expect(page.getByText(/left today/)).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // One visible action, which an operator is not asked about.
    await page.getByRole("button", { name: "Look for new solutions" }).click();
    await expect(page.getByText("Looking for solutions.")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(sent.runs).toEqual([{ judgeAll: false }]);

    // The operators' two actions are in the More menu.
    const more = page.getByRole("button", { name: "More", exact: true });
    await more.click();
    await expect(page.getByRole("menuitem", { name: "Add one by hand" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Re-review every solution" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("menuitem", { name: "Re-review every solution" }).click();
    const asking = page.getByRole("alertdialog", { name: "Re-review every solution?" });
    await asking.getByRole("button", { name: "Re-review every solution" }).click();
    await expect(page.getByText("AI is reading every solution again.")).toBeVisible();
    expect(sent.runs).toEqual([{ judgeAll: false }, { judgeAll: true }]);
    await expect(asking).toHaveCount(0);

    await more.click();
    await page.getByRole("menuitem", { name: "Add one by hand" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a solution by hand" });
    const known = dialog.getByRole("listitem").filter({ hasText: "Staple AI" });
    await expect(known.getByText("Already on the list")).toBeVisible();
    await expect(known.getByRole("button")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole("button", { name: "Add Newcomer" }).click();
    await expect(page.getByText("Newcomer added. AI reads it in the next run.")).toBeVisible();
    expect(sent.search).toBe("approved");
    expect(sent.added).toEqual({ solutionId: "50101000-0000-4000-8000-000000000099" });
    await expect(dialog).toHaveCount(0);

    // What GenAI Fund removed, an operator restores.
    await page.getByRole("tab", { name: "Removed 2" }).click();
    const fintelite = page
      .getByRole("tabpanel")
      .getByRole("listitem")
      .filter({ hasText: "Fintelite" });
    await expect(fintelite.getByRole("button", { name: "Restore" })).toBeVisible();
  });

  test("a run at work shows its stages, and each solution moves to its group as it is read", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    const useCase = runningUseCase(testInfo, 1);
    await useCase.put(request, null);
    const state = await useCase.read(request);
    const sentosa = state.candidates.find((one) => one.solutionName === "Sentosa Finance")!;
    await signInAs(context, "owner", baseURL!);
    await useCase.connect(page);
    await page.goto(useCase.path);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Document intake");
    // The stages by name: those behind are finished, the one at work is the current step.
    const stages = page.getByRole("list", { name: "Progress of the search" }).getByRole("listitem");
    await expect(stages).toHaveText([
      "Reading your brief, finished",
      "Searching the solutions, finished",
      /^Reading each solution\s*1 of 4$/,
      "Done",
    ]);
    await expect(stages.nth(2)).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("progressbar", { name: "Reading each solution" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );

    // Every solution found is a row at once: what is not read yet is being read, in a group of its own.
    const beingRead = group(page, "Being read");
    await expect(
      beingRead.getByText("Each one moves to its group when the AI has read it."),
    ).toBeVisible();
    await expect(beingRead.getByRole("listitem")).toHaveCount(3);
    await expect(row(page, "Sentosa Finance").getByText("Waiting", { exact: true })).toBeVisible();
    await expect(group(page, "Not reviewed yet")).toHaveCount(0);
    await expect(group(page, "Strong fit").getByRole("listitem")).toHaveCount(1);
    await expectNoSeriousA11yViolations(page);
    await picture(page, testInfo, "run-at-work");

    // The stream is open. The judgment of one solution starts: its row says so.
    await expect.poll(() => useCase.listeners(request)).toBe(1);
    await useCase.push(request, "reading", { solutionId: sentosa.solutionId });
    await expect(row(page, "Sentosa Finance").getByText("Reading now")).toBeVisible();
    await expect(row(page, "Docbase").getByText("Waiting", { exact: true })).toBeVisible();

    // It is read: the row enters its group, the count moves and a line says what happened.
    const second = {
      ...withCandidate(state, "Sentosa Finance", {
        judged: true,
        bucket: "industry",
        summary: "An insurer uses it for invoices.",
      }),
      run: { ...(state.run as object), judged: 2 },
    };
    await useCase.put(request, second);
    await useCase.push(request, "read", { solutionId: sentosa.solutionId });
    await expect(
      group(page, "Experience in your industry").getByRole("button", {
        name: "Sentosa Finance",
        exact: true,
      }),
    ).toBeVisible();
    await expect(beingRead.getByRole("listitem")).toHaveCount(2);
    await expect(
      page.getByText("Added Sentosa Finance to Experience in your industry"),
    ).toBeVisible();
    await expect(stages.nth(2)).toHaveText(/2 of 4$/);
    await expect(row(page, "Sentosa Finance").getByText("Reading now")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // The run ends with the two others read together, one of them in no group: the stages are all
    // finished, the line counts them, and the last group is open so that its row is seen.
    const ended = {
      ...withCandidate(
        withCandidate(second, "Docbase", { judged: true, bucket: "technology" }),
        "Paperline",
        { judged: true, bucket: "none" },
      ),
      run: {
        ...(state.run as object),
        state: "done",
        stage: null,
        judged: 4,
        endedAt: "2026-10-09T03:04:00Z",
      },
    };
    await useCase.put(request, ended);
    await useCase.push(request, "run");
    await expect(stages).toHaveText([
      "Reading your brief, finished",
      "Searching the solutions, finished",
      "Reading each solution, finished",
      "Done, finished",
    ]);
    await expect(page.getByText("2 more read, 1 added")).toBeVisible();
    await expect(page.getByText(/^Updated /)).toBeVisible();
    await expect(beingRead).toHaveCount(0);
    await expect(
      group(page, "Right technology, less proof").getByRole("button", {
        name: "Docbase",
        exact: true,
      }),
    ).toBeVisible();
    await expect(rowName(page, "Paperline")).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);
  });

  test("a page whose stream is refused still becomes current, by reading itself again", async ({
    page,
    context,
    baseURL,
    request,
  }, testInfo) => {
    const useCase = runningUseCase(testInfo, 2);
    await useCase.put(request, null);
    const state = await useCase.read(request);
    await signInAs(context, "owner", baseURL!);
    // A proxy that will not carry the stream. The browser reaches nothing else of the backend here.
    let refused = 0;
    await page.route(`**/api/matching/use-cases/${useCase.id}/events`, async (route) => {
      refused += 1;
      await route.fulfill({ status: 503 });
    });
    await page.goto(useCase.path);

    const beingRead = group(page, "Being read");
    await expect(beingRead.getByRole("listitem")).toHaveCount(3);
    await expect.poll(() => refused).toBeGreaterThan(0);
    expect(await useCase.listeners(request)).toBe(0);

    await useCase.put(request, {
      ...withCandidate(state, "Sentosa Finance", { judged: true, bucket: "industry" }),
      run: { ...(state.run as object), judged: 2 },
    });
    // The page reads itself again every five seconds while a run is open and no stream is.
    await expect(
      group(page, "Experience in your industry").getByRole("button", {
        name: "Sentosa Finance",
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(beingRead.getByRole("listitem")).toHaveCount(2);
    await expect(
      page.getByText("Added Sentosa Finance to Experience in your industry"),
    ).toBeVisible();
  });
});
