import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { criteria, judgedProgramId, plainCoverDeckId, plainCoverId } from "./stub-judging.mjs";

const admin = `/admin/programs/${judgedProgramId}`;
const stubOrigin = "http://localhost:3190";
const reviews = `/reviews/${judgedProgramId}`;

type Call = { method: string; url: string; body: unknown };

/** Records what the browser writes to the review and answers it as the backend would. */
async function recordWrites(page: Page) {
  const calls: Call[] = [];
  await page.route("**/api/proposal/review/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fallback();
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    calls.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
    if (request.url().includes("/export")) {
      // A download is named by the backend, after the program and the day.
      return route.fulfill({
        status: 200,
        contentType: "text/csv;charset=UTF-8",
        headers: {
          "Content-Disposition": `attachment; filename="insurance-ai-tasco-applications-2026-10-14.csv"`,
        },
        body: "Application",
      });
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  return calls;
}

/** Moves the pointer away, so axe reads the page at rest rather than a hovered button. */
async function settled(page: Page) {
  await page.mouse.move(0, 0);
}

test.describe("judging applications", () => {
  test("an operator reads the decisions and scores, narrows the list and decides on several at once", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/applications`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AI for Insurance Challenge × Tasco",
    );
    await expect(page.getByRole("link", { name: "Applications", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByText("3 applications · 4 drafts were not submitted · 1 withdrawn"),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "To decide 1" })).toBeVisible();
    // Once any application has a score the highest mean comes first, and a header turns the order.
    // On a phone the table is the same one, scrolled sideways.
    const score = page.getByRole("columnheader", { name: "Scores" });
    await expect(score).toHaveAttribute("aria-sort", "descending");
    await score.getByRole("button").click();
    await expect(page).toHaveURL(/sort=score/);
    await expect(score).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("columnheader", { name: "Submitted" }).getByRole("button").click();
    await expect(page).toHaveURL(/sort=submitted/);
    await page.goto(`${admin}/applications`);
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("tab", { name: "To decide 1" }).click();
    await expect(page).toHaveURL(/tab=undecided/);
    await expect(page.getByText("Claim Copilot")).toHaveCount(0);

    // The download holds the applications the list shows now, and says of all of them how many are scored.
    await expect(page.getByText("2 of 3 have a score")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("menuitem", { name: "CSV" }).click();
    expect((await download).suggestedFilename()).toBe(
      "insurance-ai-tasco-applications-2026-10-14.csv",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(`/programs/${judgedProgramId}/applications/export?format=csv`);
    expect((calls[0].body as { applicationIds: string[] }).applicationIds).toHaveLength(1);
    calls.length = 0;

    // Rows are selected and decided on together, on a phone as well.
    await page.goto(`${admin}/applications`);
    await page.getByRole("checkbox", { name: "Select Plain Cover" }).click();
    await page.getByRole("checkbox", { name: "Select Renew in a Minute" }).click();
    const selection = page.getByRole("region", { name: "Selected rows" });
    await expect(selection).toContainText("2 selected");
    await selection.getByRole("button", { name: "Shortlist" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].url).toContain(`/programs/${judgedProgramId}/decisions`);
    expect(calls[0].body).toMatchObject({ decision: "shortlisted" });
    expect((calls[0].body as { applicationIds: string[] }).applicationIds).toHaveLength(2);
  });

  test("an operator scores an application on every criterion, reads the judges' scores and decides", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    // Opened from the list sorted by when each was submitted, it stands in that order, and going
    // on keeps the list's order: Renew in a Minute, submitted after it.
    await page.goto(`${admin}/applications/${plainCoverId}?sort=submitted`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plain Cover");
    await expect(page.getByText("2 of 3")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next application" })).toHaveAttribute(
      "href",
      /a0000000-0000-4000-8000-000000000003\?sort=submitted$/,
    );
    // An answer of several choices reads as the choices, one a line.
    await expect(page.getByText("Claims Pricing, and underwriting")).toBeVisible();
    // The deck opens full screen in the page, every page of it, instead of downloading; the download
    // stays at hand, and Escape gives the focus back to Open.
    const open = page
      .getByRole("region", { name: "Files and links" })
      .getByRole("button", { name: "Open", exact: true });
    // The browser reads the file from the stub, as it reads it from the backend.
    await page.route("**/api/proposal/review/applications/*/files/*", (route) =>
      route.continue({ url: `${stubOrigin}${new URL(route.request().url()).pathname}` }),
    );
    await open.click();
    const viewer = page.getByRole("dialog", { name: "plain-cover-deck.pdf" });
    await expect(viewer.getByRole("group", { name: /^Page \d$/ })).toHaveCount(3);
    // The header says it on a wide screen, the bottom bar on a phone.
    await expect(viewer.getByText("Page 1 / 3").filter({ visible: true })).toHaveCount(1);
    await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      `/api/proposal/review/applications/${plainCoverId}/files/${plainCoverDeckId}`,
    );
    await expectNoSeriousA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(open).toBeFocused();
    // The demo the applicant gave opens in a tab of its own, away from the review.
    const demo = page.getByRole("link", { name: "https://plaincover.example/demo" });
    await expect(demo).toHaveAttribute("href", "https://plaincover.example/demo");
    await expect(demo).toHaveAttribute("target", "_blank");
    await expect(demo).toHaveAttribute("rel", "noopener noreferrer");
    // The applicant's contact is a row each, so an email or a phone number is copied on its own;
    // the email writes, the phone dials, and the profile opens in a tab of its own.
    const team = page.getByRole("region", { name: "Applicant and team" });
    await expect(team.getByRole("term")).toHaveText([
      "Applying as",
      "Name",
      "Email",
      "Phone",
      "Country",
      "Team size",
      "LinkedIn",
      "Team background",
    ]);
    await expect(team.getByRole("definition").nth(1)).toHaveText("Wei Ling Tan");
    const email = team.getByRole("link", { name: "wei.ling@plaincover.example" });
    await expect(team.getByRole("definition").nth(2)).toHaveText("wei.ling@plaincover.example");
    await expect(email).toHaveAttribute("href", "mailto:wei.ling@plaincover.example");
    await expect(team.getByRole("definition").nth(3)).toHaveText("+65 8123 4567");
    await expect(team.getByRole("link", { name: "+65 8123 4567" })).toHaveAttribute(
      "href",
      "tel:+6581234567",
    );
    const profile = team.getByRole("link", { name: "https://www.linkedin.com/in/weilingtan" });
    await expect(profile).toHaveAttribute("href", "https://www.linkedin.com/in/weilingtan");
    await expect(profile).toHaveAttribute("target", "_blank");
    await expect(profile).toHaveAttribute("rel", "noopener noreferrer");
    const scores = page.getByRole("region", { name: "Judges' scores" });
    await expect(scores).toContainText("Minh Anh Le");
    await expect(scores).toContainText("on version 1");
    await expect(page.getByText("Only GenAI Fund reads this.")).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    // The panel's own button; below 1024px the bar at the bottom repeats it.
    const assessment = page.getByRole("region", { name: /^Your assessment/ });
    const save = assessment.getByRole("button", { name: "Save and next" }).first();
    await expect(save).toBeDisabled();
    // The save is held until every criterion has a score, and the panel says so beside it.
    await expect(assessment.getByText("0 of 2 criteria scored").first()).toBeVisible();
    await expect(
      assessment.getByText("2 criteria still need a score before you can save."),
    ).toBeVisible();
    // A score is one choice of ten, with what the numbers mean in sight: a radio group, which the
    // arrow keys move along.
    await expect(
      assessment.getByText("1–3 Weak · 4–6 Average · 7–8 Strong · 9–10 Outstanding"),
    ).toBeVisible();
    const first = page.getByRole("radiogroup", { name: criteria[0].name });
    await first.getByRole("radio", { name: "3 out of 10, Weak" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(first.getByRole("radio", { name: "4 out of 10, Average" })).toBeChecked();
    await expect(first.getByRole("radio", { name: "3 out of 10, Weak" })).not.toBeChecked();
    await page
      .getByRole("radiogroup", { name: criteria[1].name })
      .getByRole("radio", { name: "3 out of 10, Weak" })
      .click();
    await expect(assessment.getByText("Average 3.5")).toBeVisible();
    // How far the scoring is stands in the panel at every width; a narrow screen repeats it in its bar.
    await expect(assessment.getByText("2 of 2 criteria scored").first()).toBeVisible();
    await expect(assessment.getByText(/still need/)).toHaveCount(0);
    await page.getByLabel("Private note").fill("Clear on consent.");
    await save.click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]).toMatchObject({
      method: "PUT",
      body: {
        scores: { [criteria[0].id]: 4, [criteria[1].id]: 3 },
        note: "Clear on consent.",
        conflict: false,
        bookmarked: false,
      },
    });

    // A decision stays on the application, which then shows it.
    await page.goto(`${admin}/applications/${plainCoverId}`);
    await page.getByRole("button", { name: "Shortlist", exact: true }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].body).toMatchObject({
      applicationIds: [plainCoverId],
      decision: "shortlisted",
    });
    await expect(page).toHaveURL(new RegExp(`${plainCoverId}$`));
  });

  test("a judge finds their program under Reviews, scores without seeing anyone else's, and never decides", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "judge", baseURL!);
    await recordWrites(page);
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reviews");
    await page.getByRole("link", { name: /AI for Insurance Challenge × Tasco/ }).click();
    await expect(page).toHaveURL(reviews);
    // A judge reads only the shortlist.
    await expect(page.getByRole("tab", { name: "All 2" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "To score 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Release outcomes" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.goto(`${reviews}/${plainCoverId}`);
    await expect(page.getByText("Only you and GenAI Fund read this.")).toBeVisible();
    // The submission without the applicant's contact details.
    await expect(page.getByText("wei.ling@plaincover.example")).toHaveCount(0);
    await expect(page.getByText("+65 8123 4567")).toHaveCount(0);
    await expect(page.getByText("Claims Pricing, and underwriting")).toBeVisible();
    await expect(page.getByRole("region", { name: "Judges' scores" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Decision" })).toHaveCount(0);
    // The judge has scored the other shortlisted application, so the one on show is the last one
    // left: nothing is next, and the way back is the application before it.
    await expect(page.getByText("2 of 2 · 1 left to score")).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Previous", exact: true })).toHaveAttribute(
      "href",
      /a0000000-0000-4000-8000-000000000001$/,
    );
    await expect(
      page.getByRole("button", { name: "I have a conflict with this applicant" }),
    ).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    // A judge has no admin area, and no program they were not invited to.
    await page.goto(`/admin/programs/${judgedProgramId}/applications`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    // A program of Reviews that is not theirs is missing inside their own frame, with the way back.
    await page.goto("/reviews/9b1e7c2a-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Reviews" })).toBeVisible();
  });

  test("an operator compares every judge's scores, the widest gaps marked, and by judge", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    await page.goto(`${admin}/scores`);

    // The shortlist leads, each scorer a column; judges 3.5 apart on one application are marked.
    await expect(
      page.getByRole("navigation", { name: "Program" }).getByRole("link", { name: "Scores" }),
    ).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: /Minh Tran/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Lan Vu/ })).toBeVisible();
    const claim = table.getByRole("row", { name: /Claim Copilot/ });
    await expect(claim).toContainText("4.3");
    await expect(claim).toContainText("Judges far apart");
    await expect(table.getByRole("row")).toHaveCount(2);

    // Every application, the highest mean first; a step back reads Conflict, and none scored last.
    await page.getByRole("tab", { name: /^All/ }).click();
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByRole("row").nth(1)).toContainText("Claim Copilot");
    await expect(table.getByRole("row").nth(2)).toContainText("Renew in a Minute");
    await expect(table.getByRole("row").nth(2)).toContainText("Conflict");
    await expect(table.getByRole("row").nth(3)).toContainText("Plain Cover");

    // An application opens in the Applications list's order, the tab kept.
    await expect(claim.getByRole("link", { name: "Claim Copilot" })).toHaveAttribute(
      "href",
      /\/applications\/a0000000-0000-4000-8000-000000000001\?sort=-score$/,
    );

    // By judge: each scorer's work and mean over the applications kept.
    await page.getByRole("button", { name: "By judge" }).click();
    await expect(page).toHaveURL(/view=judges/);
    const lan = page.getByRole("row", { name: /Lan Vu/ });
    await expect(lan).toContainText("Judge");
    await expect(lan).toContainText("6.0");
    await settled(page);
    await expectNoSeriousA11yViolations(page);
  });

  test("an operator invites a judge and sees the criteria fixed once scored", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/reviewers`);
    await expect(page.getByRole("heading", { name: "Judging criteria" })).toBeVisible();
    await expect(
      page.getByText("Applications have been scored on these, so they no longer change."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit criteria" })).toHaveCount(0);
    await expect(page.getByText("thu.pham@tasco.example")).toBeVisible();
    // A step back for a conflict is done, and named, so it is not read as a score.
    await expect(page.getByText("2 of 3 applications done · 1 conflict")).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Invite a judge" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill("new.judge@tasco.example");
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ email: "new.judge@tasco.example" });
  });

  test("an operator releases the outcomes after a question that names how many each email reaches", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/release`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Release outcomes");
    await expect(page.getByText("1 withdrawn application gets no email.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Shortlisted/ })).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Release to 3 applicants" }).click();
    const ask = page.getByRole("alertdialog", { name: "Email 3 applicants now?" });
    await expect(ask).toContainText("Shortlisted: 2 applicants");
    await expect(ask).toContainText("Not selected: 1 applicant");
    expect(calls).toHaveLength(0);
    await ask.getByRole("button", { name: "Release and send" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toMatchObject({
      shortlistedSubject: "You're shortlisted for AI for Insurance Challenge × Tasco",
      notSelectedSubject: "Your application to AI for Insurance Challenge × Tasco",
    });
  });

  test("each group's email is previewed as an applicant gets it, and a mistyped placeholder holds the release back", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/release`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Release outcomes");

    // The shortlisted email as its first applicant gets it, then as the second.
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview).toContainText("To Pocket Policy · Claim Copilot");
    await expect(preview).toContainText("Hi Pocket Policy,");
    await expect(preview).toContainText("Claim Copilot is shortlisted.");
    await expect(preview).toContainText("The BeyondPilot team at GenAI Fund");
    await preview.getByRole("button", { name: "Next applicant" }).click();
    await expect(preview).toContainText("Hi Plain Cover Pte,");
    await expect(preview).toContainText("2 of 2");

    // A placeholder the backend would not fill in is named, and the release waits for it.
    await page.getByLabel("Message").fill("Hi {organisation},\n\n{Solution} is shortlisted.");
    await expect(
      page.getByText(
        "{organisation}, {Solution} won't be filled in. Use {organization} or {solution}.",
      ),
    ).toBeVisible();
    await expect(preview).toContainText("Hi {organisation},");
    await expect(page.getByRole("button", { name: "Release to 3 applicants" })).toBeDisabled();
    await page.getByLabel("Message").fill("Hi {organization},\n\n{solution} is shortlisted.");
    await expect(page.getByRole("button", { name: "Release to 3 applicants" })).toBeEnabled();
    await settled(page);
    await expectNoSeriousA11yViolations(page);
    expect(calls.filter((call) => !call.url.includes("/release/draft"))).toHaveLength(0);
  });

  test("the emails of a release are saved as they are written, and leaving before that asks first", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/release`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Release outcomes");

    // What is typed is not on the server yet: the page says so, and leaving asks first.
    await page.getByLabel("Subject").fill("Shortlisted: AI for Insurance Challenge");
    await expect(page.getByRole("status").filter({ hasText: "Not saved yet" })).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("link", { name: "Applications", exact: true })
      .first()
      .click();
    const leave = page.getByRole("alertdialog", { name: "Leave before it is saved?" });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Stay" }).click();

    // A moment after the last key it is saved by itself, all four parts together, and nothing is released.
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toContain("/release/draft");
    expect(calls[0].body).toMatchObject({
      shortlistedSubject: "Shortlisted: AI for Insurance Challenge",
      notSelectedSubject: "Your application to AI for Insurance Challenge × Tasco",
    });
    await expect(
      page.getByRole("status").filter({ hasText: /^Saved \d\d:\d\d ICT$/ }),
    ).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);
  });
});
