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

  it("opens the public site to search and answers but not to training", () => {
    const robots = robotsTxt("beyondpilot.ai");

    expect(robots).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no");
    expect(robots).toMatch(/User-agent: GPTBot\n(User-agent: .+\n)*Disallow: \/\n/);
    expect(robots).toMatch(/User-agent: ChatGPT-User\n(User-agent: .+\n)*Allow: \/\n/);
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Sitemap: https://beyondpilot.ai/sitemap.xml");
  });
});
