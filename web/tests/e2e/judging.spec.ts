import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";
import { criteria, judgedProgramId, plainCoverId } from "./stub-judging.mjs";

const admin = `/admin/programs/${judgedProgramId}`;
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
    isMobile,
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
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("tab", { name: "To decide 1" }).click();
    await expect(page).toHaveURL(/tab=undecided/);
    await expect(page.getByText("Claim Copilot")).toHaveCount(0);

    if (!isMobile) {
      await page.goto(`${admin}/applications`);
      await page.getByRole("checkbox", { name: "Select Plain Cover" }).click();
      await page.getByRole("checkbox", { name: "Select Renew in a Minute" }).click();
      const selection = page.getByRole("region", { name: "Selected applications" });
      await expect(selection).toContainText("2 selected");
      await selection.getByRole("button", { name: "Shortlist" }).click();
      await expect.poll(() => calls.length).toBe(1);
      expect(calls[0].url).toContain(`/programs/${judgedProgramId}/decisions`);
      expect(calls[0].body).toMatchObject({ decision: "shortlisted" });
      expect((calls[0].body as { applicationIds: string[] }).applicationIds).toHaveLength(2);
    }
  });

  test("an operator scores an application on every criterion, reads the judges' scores and decides", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/applications/${plainCoverId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plain Cover");
    await expect(page.getByText("2 of 3")).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: "plain-cover-deck.pdf" })
        .or(page.getByRole("link", { name: "Open", exact: true })),
    ).toHaveAttribute(
      "href",
      `/api/proposal/review/applications/${plainCoverId}/files/f0000000-0000-4000-8000-000000000001`,
    );
    const scores = page.getByRole("region", { name: "Judges' scores" });
    await expect(scores).toContainText("Minh Anh Le");
    await expect(scores).toContainText("on version 1");
    await expect(page.getByText("Only GenAI Fund reads this.")).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    const save = page.getByRole("button", { name: "Save and next" });
    await expect(save).toBeDisabled();
    await page
      .getByRole("group", { name: criteria[0].name })
      .getByRole("button", { name: "4 out of 5" })
      .click();
    await page
      .getByRole("group", { name: criteria[1].name })
      .getByRole("button", { name: "3 out of 5" })
      .click();
    await expect(page.getByText("Average 3.5")).toBeVisible();
    await page.getByLabel("Private note").fill("Clear on consent.");
    await save.click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]).toMatchObject({
      method: "PUT",
      body: {
        scores: { [criteria[0].id]: 4, [criteria[1].id]: 3 },
        note: "Clear on consent.",
        conflict: false,
      },
    });

    await page.goto(`${admin}/applications/${plainCoverId}`);
    await page.getByRole("button", { name: "Shortlist and next" }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].body).toMatchObject({
      applicationIds: [plainCoverId],
      decision: "shortlisted",
    });
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
    await expect(page.getByRole("tab", { name: "To score 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Release outcomes" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.goto(`${reviews}/${plainCoverId}`);
    await expect(page.getByText("Only you and GenAI Fund read this.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Judges' scores" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Decision" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Skip", exact: true })).toHaveAttribute(
      "href",
      /a0000000-0000-4000-8000-000000000003$/,
    );
    await expect(
      page.getByRole("button", { name: "I have a conflict with this applicant" }),
    ).toBeVisible();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    // A judge has no admin area, and no program they were not invited to.
    await page.goto(`/admin/programs/${judgedProgramId}/applications`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
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
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Invite a judge" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email address").fill("new.judge@tasco.example");
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toEqual({ email: "new.judge@tasco.example" });
  });

  test("an operator releases the outcomes after saying both lists were checked", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "operator", baseURL!);
    const calls = await recordWrites(page);
    await page.goto(`${admin}/release`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Release outcomes");
    await expect(page.getByText("1 withdrawn application gets no email.")).toBeVisible();
    const release = page.getByRole("button", { name: "Release to 3 applicants" });
    await expect(release).toBeDisabled();
    await settled(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("checkbox").click();
    await release.click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].body).toMatchObject({
      shortlistedSubject: "You're shortlisted for AI for Insurance Challenge × Tasco",
      notSelectedSubject: "Your application to AI for Insurance Challenge × Tasco",
    });
  });
});
