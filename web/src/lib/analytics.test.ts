import { describe, expect, it } from "vitest";

import { isTrackedPath } from "./analytics";

// Google Analytics learns the address and the title of every page it measures, so the pages of a
// signed-in person, and an address that is itself a key, must stay out of it.
describe("isTrackedPath", () => {
  it.each([
    "/",
    "/programs",
    "/programs/insurance-ai-tasco",
    "/programs/insurance-ai-tasco/apply",
    "/use-cases/42",
    "/solutions",
    "/solutions/acme-claims",
    "/talent/jane-doe",
    "/about",
  ])("measures the public page %s", (pathname) => {
    expect(isTrackedPath(pathname)).toBe(true);
  });

  it.each([
    "/admin",
    "/admin/programs/7/applications",
    "/workspace/organization/members",
    "/reviews/7/19",
    "/account",
    "/account/mcp",
    "/applications",
    "/applications/19",
    "/oauth-consent",
    "/sign-in",
    "/solutions/shared/3f9c1b",
  ])("keeps %s out of the measurement", (pathname) => {
    expect(isTrackedPath(pathname)).toBe(false);
  });

  it("measures a public page whose name only starts like a private area", () => {
    expect(isTrackedPath("/accounting-solutions")).toBe(true);
    expect(isTrackedPath("/administration")).toBe(true);
  });
});
