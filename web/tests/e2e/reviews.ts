import { expect, type Page } from "@playwright/test";

type Decision = { call: string; body: unknown };

/**
 * Answers the decisions the browser sends under a path (everything but a read); returns those it
 * saw, each with what it carried. `answer` is the body: a problem when the status is a refusal.
 */
export async function answerDecisions(page: Page, path: string, status: number, answer?: object) {
  const decisions: Decision[] = [];
  await page.route(path, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fallback();
    }
    expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
    decisions.push({
      call: `${request.method()} ${new URL(request.url()).pathname}`,
      body: request.postDataJSON(),
    });
    await route.fulfill({
      status,
      ...(answer && {
        contentType: status < 400 ? "application/json" : "application/problem+json",
        body: JSON.stringify(answer),
      }),
    });
  });
  return decisions;
}

/** A refusal of the backend whose own text must never reach the screen. */
export function refusal(code: string) {
  return {
    status: 409,
    title: "Conflict",
    code,
    detail: "text of the backend that must not be shown",
    requestId: "0b0f6a52-1d8e-4c0e-9d0a-5a7c1e2f3a44",
  };
}

/** Chooses the reason of a refusal and writes its note, in the dialog that asks for them. */
export async function giveReason(page: Page, reason: string, note: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: reason }).click();
  await dialog.getByRole("textbox").fill(note);
  return dialog;
}
