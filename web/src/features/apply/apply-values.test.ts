import { describe, expect, it } from "vitest";

import type { ApplicationView, Solution } from "@/lib/api/generated";

import { saveBodyOf } from "./apply-draft";
import {
  answersFor,
  appliesAlone,
  organizationBodyOf,
  solutionBodyOf,
  solutionDraftOf,
  valuesOf,
} from "./apply-values";

const direction = "7c1e0a2b-0000-4000-8000-000000000001";
const areas = "7c1e0a2b-0000-4000-8000-000000000005";
const gone = "7c1e0a2b-0000-4000-8000-0000000000aa";

const program = { questions: [{ id: direction }, { id: areas }] };

const claimCopilot = {
  id: "5a0b7c1d-0000-4000-8000-000000000010",
  name: "Claim Copilot",
  summary: "A chat assistant.",
  problemsSolved: null,
  maturity: "pilot",
};

function view(more: Record<string, unknown> = {}) {
  return {
    program,
    solutions: [],
    application: null,
    previous: null,
    ...more,
  } as unknown as ApplicationView;
}

describe("valuesOf", () => {
  it("starts a first application with nothing chosen, nothing confirmed and every question empty", () => {
    expect(valuesOf(view(), { country: "VN", phone: "+84 912 345 678" })).toEqual({
      who: "",
      team: { name: "", size: "2_9", website: "" },
      application: {
        contact: {
          firstName: "",
          lastName: "",
          phone: "+84 912 345 678",
          country: "VN",
          linkedin: "",
        },
        teamBackground: "",
        solutionId: null,
        deck: null,
        builtWith: [],
        traction: "",
        answers: { [direction]: "", [areas]: "" },
      },
      solution: { id: null, name: "", summary: "", problemsSolved: "", maturity: "", demoUrl: "" },
      confirmed: false,
    });
  });

  it("reads a draft stored earlier: its answers as stored, the others empty, its solution filled in", () => {
    const values = valuesOf(
      view({
        solutions: [claimCopilot, { id: "other", name: "Other" }],
        application: {
          contact: { firstName: "An" },
          solutionId: claimCopilot.id,
          answers: {
            [gone]: "An answer to a question since removed",
            [areas]: '["Claims","An area no longer offered"]',
          },
        },
      }),
      {},
    );

    expect(values.application.answers).toEqual({
      [gone]: "An answer to a question since removed",
      [areas]: '["Claims","An area no longer offered"]',
      [direction]: "",
    });
    expect(values.solution).toEqual({
      id: claimCopilot.id,
      name: "Claim Copilot",
      summary: "A chat assistant.",
      problemsSolved: "",
      maturity: "pilot",
      demoUrl: "",
    });
    // What is saved from it is what was stored: an empty answer is not sent.
    expect(saveBodyOf(values.application, 3)).toMatchObject({
      contact: { firstName: "An", lastName: null },
      solutionId: claimCopilot.id,
      answers: {
        [gone]: "An answer to a question since removed",
        [areas]: '["Claims","An area no longer offered"]',
      },
      version: 3,
    });
    expect(Object.keys(saveBodyOf(values.application, 3).answers)).toHaveLength(2);
  });

  it("starts from a new solution when the stored one is no longer the organization's", () => {
    const values = valuesOf(view({ application: { solutionId: "left", answers: {} } }), {});

    expect(values.application.solutionId).toBe("left");
    expect(values.solution.id).toBeNull();
  });

  it("takes the organization's only solution as the likely one", () => {
    const values = valuesOf(view({ solutions: [claimCopilot] }), {});

    expect(values.application.solutionId).toBe(claimCopilot.id);
    expect(values.solution.name).toBe("Claim Copilot");
  });
});

describe("answersFor", () => {
  it("answers the same object when every question has an answer", () => {
    const answers = { [direction]: "Claiming", [areas]: "" };

    expect(answersFor(answers, program.questions)).toBe(answers);
  });

  it("adds an empty answer for a question without one and keeps the rest", () => {
    expect(answersFor({ [gone]: "kept" }, program.questions)).toEqual({
      [gone]: "kept",
      [direction]: "",
      [areas]: "",
    });
  });
});

describe("solutionDraftOf", () => {
  it("is a new solution for no identifier and for one the organization does not have", () => {
    const empty = {
      id: null,
      name: "",
      summary: "",
      problemsSolved: "",
      maturity: "",
      demoUrl: "",
    };

    expect(solutionDraftOf(view({ solutions: [claimCopilot] }), null)).toEqual(empty);
    expect(solutionDraftOf(view({ solutions: [claimCopilot] }), "left")).toEqual(empty);
  });
});

describe("appliesAlone", () => {
  it("follows the organization when there is one, and the choice when there is none", () => {
    expect(
      appliesAlone({ type: "independent_builder" } as ApplicationView["organization"], "team"),
    ).toBe(true);
    expect(
      appliesAlone({ type: "builder_team" } as ApplicationView["organization"], "individual"),
    ).toBe(false);
    expect(appliesAlone(null, "")).toBe(true);
    expect(appliesAlone(null, "individual")).toBe(true);
    expect(appliesAlone(null, "team")).toBe(false);
    expect(appliesAlone(null, "company")).toBe(false);
  });
});

describe("organizationBodyOf", () => {
  const values = valuesOf(view(), {});
  const typed = {
    ...values,
    team: { name: " Pocket Policy ", size: "10_49", website: " " },
    application: {
      ...values.application,
      contact: {
        ...values.application.contact,
        firstName: " An ",
        lastName: " Tran ",
        country: "VN",
      },
    },
  };

  it("names an individual by their own name, with nothing of a team", () => {
    expect(organizationBodyOf({ ...typed, who: "individual" })).toEqual({
      kind: "individual",
      name: "An Tran",
      country: "VN",
    });
  });

  it("names a team by its name, with its size and its website or none", () => {
    expect(organizationBodyOf({ ...typed, who: "team" })).toEqual({
      kind: "team",
      name: "Pocket Policy",
      country: "VN",
      teamSize: "10_49",
      website: null,
    });
    expect(
      organizationBodyOf({
        ...typed,
        who: "team",
        team: { ...typed.team, website: " https://pocketpolicy.example " },
      }).website,
    ).toBe("https://pocketpolicy.example");
  });
});

describe("solutionBodyOf", () => {
  const found = {
    id: claimCopilot.id,
    name: "Claim Copilot",
    summary: "Old summary.",
    problemsSolved: "Old problem.",
    valueProposition: "Faster claims.",
    focusAreas: ["claims"],
    industries: ["insurance"],
    maturity: "pilot",
    deployment: ["cloud"],
    website: "https://claimcopilot.example",
    demoUrl: "https://claimcopilot.example/demo",
    traction: "Two pilots.",
    builtWith: ["OpenAI GPT"],
    languages: ["en"],
    bestCustomerProfile: null,
    deck: { fileId: "deck-file" },
    logo: null,
    cover: { fileId: "cover-file" },
    images: [{ fileId: "image-1" }, { fileId: "image-2" }],
    offers: [{ id: "offer-1" }],
    listed: true,
    version: 5,
  } as unknown as Solution;
  const step = {
    id: claimCopilot.id,
    name: " Claim Copilot 2 ",
    summary: " New summary. ",
    problemsSolved: " ",
    maturity: "",
    demoUrl: "",
  };

  it("sends what the step edits and everything else as the solution holds it", () => {
    expect(solutionBodyOf(step, found)).toEqual({
      name: "Claim Copilot 2",
      summary: "New summary.",
      problemsSolved: null,
      valueProposition: "Faster claims.",
      focusAreas: ["claims"],
      industries: ["insurance"],
      maturity: undefined,
      deployment: ["cloud"],
      website: "https://claimcopilot.example",
      demoUrl: "https://claimcopilot.example/demo",
      traction: "Two pilots.",
      builtWith: ["OpenAI GPT"],
      languages: ["en"],
      bestCustomerProfile: null,
      deckFileId: "deck-file",
      logoFileId: null,
      coverFileId: "cover-file",
      imageFileIds: ["image-1", "image-2"],
      offerIds: ["offer-1"],
      listed: true,
      version: 5,
    });
  });

  it("takes a demo link typed in the step over the stored one", () => {
    expect(solutionBodyOf({ ...step, demoUrl: " https://new.example " }, found).demoUrl).toBe(
      "https://new.example",
    );
  });
});
