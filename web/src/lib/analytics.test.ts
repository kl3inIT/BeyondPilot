import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isTrackedPath, trackedSections } from "./analytics";

/** The areas of the site that are deliberately left out of the measurement. */
const privateSections = [
  "admin",
  "workspace",
  "reviews",
  "account",
  "applications",
  "oauth-consent",
  "sign-in",
];

const localeDirectory = join(import.meta.dirname, "../app/[locale]");

function directories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** The first URL segment of every page: route groups add none, so their folders are opened. */
function routeSections(): string[] {
  return directories(localeDirectory)
    .flatMap((name) => (name.startsWith("(") ? directories(join(localeDirectory, name)) : [name]))
    .filter((name) => !name.startsWith("["));
}

// Google Analytics learns the address and the title of every page it measures, so the pages of a
// signed-in person, and an address that is itself a key, must stay out of it.
describe("isTrackedPath", () => {
  it.each([
    "/",
    "/programs",
    "/programs/insurance-ai-tasco",
    "/programs/insurance-ai-tasco/apply",
    "/use-cases/42",
    "/use-cases/42/propose",
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
    "/solutions/shared",
    "/solutions/shared/3f9c1b",
    "/use-cases/42/propose/view",
  ])("keeps %s out of the measurement", (pathname) => {
    expect(isTrackedPath(pathname)).toBe(false);
  });

  it("keeps an area nobody has decided on out of the measurement", () => {
    expect(isTrackedPath("/billing")).toBe(false);
    expect(isTrackedPath("/administration")).toBe(false);
  });

  it("has a decision for every area of the site", () => {
    const decided = new Set<string>([...trackedSections, ...privateSections]);

    expect(routeSections().filter((section) => !decided.has(section))).toEqual([]);
  });

  it("never measures an area that is also listed as private", () => {
    expect(trackedSections.filter((section) => privateSections.includes(section))).toEqual([]);
  });
});
