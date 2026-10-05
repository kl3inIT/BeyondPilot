import { describe, expect, it } from "vitest";

import { robotsTxt } from "./robots";

// Staging serves the same pages as the public site; only the public address may be indexed.
describe("robotsTxt", () => {
  it.each([
    ["staging", "beyondpilot.vadan.app"],
    ["a local run", "localhost:3000"],
    ["no host", null],
  ])("closes %s to every crawler", (_, host) => {
    expect(robotsTxt(host)).toBe("User-agent: *\nDisallow: /\n");
  });

  it("opens the public site to every crawler except the private areas", () => {
    expect(robotsTxt("beyondpilot.ai")).toBe(
      [
        "User-agent: *",
        "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /vi/admin",
        "Disallow: /api/",
        "",
        "Sitemap: https://beyondpilot.ai/sitemap.xml",
        "",
      ].join("\n"),
    );
  });
});
