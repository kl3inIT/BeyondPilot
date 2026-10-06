import { describe, expect, it } from "vitest";

import { snippetParts } from "./search-snippet";

const mark = (word: string) => `${String.fromCharCode(2)}${word}${String.fromCharCode(3)}`;

describe("snippetParts", () => {
  it("splits the matched words from the text around them", () => {
    expect(snippetParts(`Doanh nghiệp ${mark("Việt")} ${mark("Nam")} thử nghiệm AI`)).toEqual([
      { text: "Doanh nghiệp ", matched: false },
      { text: "Việt", matched: true },
      { text: " ", matched: false },
      { text: "Nam", matched: true },
      { text: " thử nghiệm AI", matched: false },
    ]);
  });

  it("keeps text without marks whole, and markup as text", () => {
    expect(snippetParts("<b>AI</b> for insurers")).toEqual([
      { text: "<b>AI</b> for insurers", matched: false },
    ]);
  });

  it("ends an unclosed mark at the end of the text", () => {
    expect(snippetParts(`For ${String.fromCharCode(2)}AI`)).toEqual([
      { text: "For ", matched: false },
      { text: "AI", matched: true },
    ]);
  });

  it("gives nothing for nothing", () => {
    expect(snippetParts("")).toEqual([]);
  });
});
