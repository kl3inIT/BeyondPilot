import { describe, expect, it } from "vitest";

import type { Solution } from "@/lib/api/generated";

import {
  badLinks,
  contentOf,
  held,
  missingForReview,
  toRequest,
  type SolutionDraft,
} from "./solution-editor-state";

const solution: Solution = {
  id: "ad5a7e96-4d42-4e97-9e99-4b7d0d0f1e11",
  organizationId: "5b1d6a0e-7f6b-4b3f-8a55-0a8a2f6f3c01",
  organizationName: "Pocket Policy",
  slug: "policy-chat",
  name: "Policy Chat",
  summary: "Answers policy holders.",
  problemsSolved: null,
  valueProposition: null,
  maturity: "pilot",
  traction: null,
  builtWith: ["Python"],
  industries: ["insurance"],
  focusAreas: ["conversational_ai"],
  languages: ["vi"],
  deployment: ["cloud_saas"],
  channels: null,
  bestCustomerProfile: null,
  backing: null,
  website: null,
  demoUrl: null,
  deck: null,
  logo: { fileId: "l1", fileName: "logo.png", sizeBytes: 20 },
  cover: { fileId: "c1", fileName: "cover.png", sizeBytes: 30 },
  images: [],
  status: "draft",
  decisionMessage: null,
  listed: true,
  complete: true,
  submittedAt: null,
  version: 3,
  updatedAt: "2026-10-03T07:32:00Z",
  customerDeployments: [],
};

const draft = (changes: Partial<SolutionDraft> = {}): SolutionDraft => ({
  ...held(solution),
  ...changes,
});

describe("toRequest", () => {
  it("sends what the backend keeps: trimmed, empty as null, each name and code once", () => {
    const request = toRequest(
      draft({
        name: "  Policy Chat ",
        summary: "   ",
        builtWith: [" Python ", "Python", "", "PostgreSQL"],
        languages: ["vi", "en", "vi"],
        maturity: "",
        deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10, attachedAt: null },
        images: [
          { fileId: "i2", fileName: "second.png", sizeBytes: 40 },
          { fileId: "i1", fileName: "first.png", sizeBytes: 40 },
        ],
      }),
      7,
    );

    expect(request).toMatchObject({
      name: "Policy Chat",
      summary: null,
      builtWith: ["Python", "PostgreSQL"],
      languages: ["vi", "en"],
      maturity: null,
      deckFileId: "f1",
      logoFileId: "l1",
      coverFileId: "c1",
      // The images keep the order the editor holds them in.
      imageFileIds: ["i2", "i1"],
      version: 7,
    });
  });
});

describe("contentOf", () => {
  it("is the same for two drafts the backend would keep alike", () => {
    expect(contentOf(draft({ name: "Policy Chat  " }))).toBe(contentOf(draft()));
    expect(contentOf(draft({ summary: "Answers policy holders.\n" }))).toBe(contentOf(draft()));
  });

  it("differs when what would be saved differs", () => {
    expect(contentOf(draft({ listed: false }))).not.toBe(contentOf(draft()));
    expect(
      contentOf(
        draft({ deck: { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10, attachedAt: null } }),
      ),
    ).not.toBe(contentOf(draft()));
  });

  it("differs when the images change their order", () => {
    const first = { fileId: "i1", fileName: "first.png", sizeBytes: 40 };
    const second = { fileId: "i2", fileName: "second.png", sizeBytes: 40 };

    expect(contentOf(draft({ images: [first, second] }))).not.toBe(
      contentOf(draft({ images: [second, first] })),
    );
  });

  it("does not depend on when a deck was attached", () => {
    const deck = { fileId: "f1", fileName: "deck.pdf", sizeBytes: 10 };

    expect(contentOf(draft({ deck: { ...deck, attachedAt: null } }))).toBe(
      contentOf(draft({ deck: { ...deck, attachedAt: "2026-10-03T07:32:00Z" } })),
    );
  });
});

describe("missingForReview", () => {
  it("names what a review needs and the draft lacks, in the order of the editor", () => {
    expect(
      missingForReview(
        draft({
          name: " ",
          summary: "",
          maturity: "",
          industries: [],
          focusAreas: [],
          logo: null,
          cover: null,
        }),
      ),
    ).toEqual(["name", "summary", "maturity", "industries", "focusAreas", "logo", "cover"]);
  });

  it("asks for nothing more than the name, what it does, its stage, an industry, a capability, a logo and a cover", () => {
    expect(
      missingForReview(
        draft({
          problemsSolved: "",
          builtWith: [],
          languages: [],
          deployment: [],
          deck: null,
          images: [],
        }),
      ),
    ).toEqual([]);
  });
});

describe("badLinks", () => {
  it("accepts an empty link and a full address, and names anything else", () => {
    expect(badLinks(draft({ demoUrl: "", website: " https://example.com/page " }))).toEqual([]);
    expect(
      badLinks(draft({ demoUrl: "example.com/demo", website: "javascript:alert(1)" })),
    ).toEqual(["demoUrl", "website"]);
  });
});
