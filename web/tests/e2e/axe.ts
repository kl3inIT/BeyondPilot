import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Waits until the page has not scrolled for a few frames. A smooth scroll still running moves a
 * sticky bar over what is under it for a moment, which reads as a target too small to press.
 */
async function scrollSettled(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = window.scrollY;
        let still = 0;
        const frame = () => {
          if (window.scrollY === last) {
            still += 1;
          } else {
            still = 0;
            last = window.scrollY;
          }
          if (still >= 5) {
            resolve();
          } else {
            requestAnimationFrame(frame);
          }
        };
        requestAnimationFrame(frame);
      }),
  );
}

async function seriousViolations(page: Page) {
  await scrollSettled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

// Fails on any serious or critical WCAG 2.2 A/AA finding; no rule is excluded.
export async function expectNoSeriousA11yViolations(page: Page) {
  let serious = await seriousViolations(page);
  // Next.js takes the <title> out of the head and puts it back each time a client navigation
  // lands (measured: a gap of a few milliseconds). A page read in that gap has no title, so a
  // finding of that rule is read once more, with the title awaited; a page that really has none
  // fails the wait.
  if (serious.some((violation) => violation.id === "document-title")) {
    await expect(page).toHaveTitle(/\S/);
    serious = await seriousViolations(page);
  }
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
}
