import { describe, expect, it } from "vitest";

import { initials } from "./initials";

// The initials stand where a person has no photo, so a bracket or a dash must never be one of them.
describe("initials", () => {
  it.each([
    ["Linh Tran", "LT"],
    ["  nguyễn văn đức  ", "NĐ"],
    ["Madonna", "M"],
    ["Linh Tran (Andy)", "LA"],
    ["Linh Tran -", "LT"],
    ["3M Vietnam", "3V"],
  ])("reads %j as %j", (name, expected) => {
    expect(initials(name, "someone@example.test")).toBe(expected);
  });

  it.each([null, "", "  ", "(-)"])("falls back to the address for the name %j", (name) => {
    expect(initials(name, "someone@example.test")).toBe("S");
  });
});
