import { describe, expect, it } from "vitest";

import { canonicalUrl } from "./canonical-host";

// The public site answers on beyondpilot.ai and on www.beyondpilot.ai; only the first is its address.
describe("canonicalUrl", () => {
  it("sends the www name to the same page of the public address", () => {
    expect(canonicalUrl("www.beyondpilot.ai", "/vi/programs?q=ai")).toBe(
      "https://beyondpilot.ai/vi/programs?q=ai",
    );
    expect(canonicalUrl("www.beyondpilot.ai", "/")).toBe("https://beyondpilot.ai/");
  });

  it.each([
    ["the public address", "beyondpilot.ai"],
    ["staging", "beyondpilot.vadan.app"],
    ["a local run", "localhost:3000"],
    ["a name that only looks like it", "www.beyondpilot.ai.example.com"],
    ["no host", null],
  ])("leaves %s where it is", (_, host) => {
    expect(canonicalUrl(host, "/programs")).toBeNull();
  });
});
