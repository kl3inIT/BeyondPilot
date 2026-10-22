import { describe, expect, it } from "vitest";

import { splitConsentText } from "./consent-text";

const text = `Before you use the platform, please read this.

## 1. Who we are

GenAI Fund.

## 7. Your consent

- I agree to use the platform. (Required)
- I agree to share with partners. (Required to take part in programs)
- I agree to AI. (Optional)

This consent is provided in line with the law.
`;

describe("splitConsentText", () => {
  it("puts the sections before the boxes, each box's own words, and what follows", () => {
    const { body, boxes, closing } = splitConsentText(text);

    expect(body).toBe(
      "Before you use the platform, please read this.\n\n## 1. Who we are\n\nGenAI Fund.",
    );
    expect(boxes).toEqual([
      "I agree to use the platform.",
      "I agree to share with partners.",
      "I agree to AI.",
    ]);
    expect(closing).toBe("This consent is provided in line with the law.");
  });

  it("keeps a text without boxes whole", () => {
    expect(splitConsentText("## 1. Who we are\n\nGenAI Fund.\n")).toEqual({
      body: "## 1. Who we are\n\nGenAI Fund.",
      boxes: [],
      closing: "",
    });
  });
});
