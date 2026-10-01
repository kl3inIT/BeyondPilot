import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Fails on any serious or critical WCAG 2.2 A/AA finding; no rule is excluded.
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
}
