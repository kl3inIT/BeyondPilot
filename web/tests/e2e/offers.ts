import type { Page } from "@playwright/test";

// The two offers of the stub backend's list (tests/e2e/stub-directories.mjs).
export const cloudCredits = {
  id: "0ffe7a11-0000-4000-8000-000000000001",
  title: "$1,000 in cloud credits",
  url: "https://offers.example/cloud-credits",
  fromGenAiFund: true,
};
export const onboarding = {
  id: "0ffe7a11-0000-4000-8000-000000000002",
  title: "Ten hours of onboarding support",
  url: "https://offers.example/onboarding",
  fromGenAiFund: false,
};

/**
 * Answers the list of offers the picker asks for from the browser, as the backend would. The web
 * server of a test run does not forward the browser's calls, so the stub backend never sees this one.
 */
export async function answerOfferList(page: Page) {
  await page.route("**/api/solution/offers?**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([cloudCredits, onboarding]),
        })
      : route.fallback(),
  );
}
