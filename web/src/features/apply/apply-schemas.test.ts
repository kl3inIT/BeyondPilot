import { describe, expect, it } from "vitest";

import type { ApplicationView } from "@/lib/api/generated";

import {
  applyStepSchema,
  contactShapeSchema,
  firstUnfinished,
  lackingBy,
  problemsOf,
  type ApplyContext,
  type ApplyStep,
  type ApplyWords,
} from "./apply-schemas";
import { valuesOf, type ApplyValues } from "./apply-values";

// Each message is its own key, so a test reads which rule refused.
const words = Object.fromEntries(
  [
    "required",
    "whoRequired",
    "companyRequired",
    "phoneRequired",
    "countryRequired",
    "linkedinInvalid",
    "webAddress",
    "maturityRequired",
    "deckRequired",
    "answerRequired",
    "answerConfirmRequired",
    "answerChoicesRequired",
    "confirmRequired",
  ].map((key) => [key, key]),
) as ApplyWords;

const text = "7c1e0a2b-0000-4000-8000-000000000002";
const file = "7c1e0a2b-0000-4000-8000-000000000003";
const confirm = "7c1e0a2b-0000-4000-8000-000000000004";
const choices = "7c1e0a2b-0000-4000-8000-000000000005";
const optional = "7c1e0a2b-0000-4000-8000-000000000006";

const questions: ApplyContext["questions"] = [
  { id: text, kind: "long_text", required: true },
  { id: file, kind: "file", required: true },
  { id: confirm, kind: "confirm", required: true },
  { id: choices, kind: "multi_choice", required: true },
  { id: optional, kind: "short_text", required: false },
];

const empty = valuesOf(
  {
    program: { questions },
    solutions: [],
    application: null,
    previous: null,
  } as unknown as ApplicationView,
  {},
);

const team = { type: "builder_team" } as ApplicationView["organization"];
const builder = { type: "independent_builder" } as ApplicationView["organization"];

/** The fields a step refuses, each with the rule that refused it. */
function refused(
  step: ApplyStep,
  values: ApplyValues,
  organization: ApplicationView["organization"] = null,
) {
  const problems = problemsOf(
    applyStepSchema(step, words, { organization, who: values.who, questions }),
    values,
  );
  return Object.fromEntries(
    Object.entries(problems ?? {}).map(([field, problem]) => [field, problem.message]),
  );
}

const contact = {
  firstName: "An",
  lastName: "Tran",
  phone: "+84 912 345 678",
  country: "VN",
  linkedin: "",
};
const you: ApplyValues = {
  ...empty,
  who: "individual",
  application: { ...empty.application, contact },
};

describe("step 1, you and your team", () => {
  it("names everything a person in no organization has yet to fill, each by its own words", () => {
    expect(refused("you", empty)).toEqual({
      who: "whoRequired",
      "application.contact.firstName": "required",
      "application.contact.lastName": "required",
      "application.contact.phone": "phoneRequired",
      "application.contact.country": "countryRequired",
    });
  });

  it("lets an individual with their contact details through, with or without a LinkedIn address", () => {
    expect(refused("you", you)).toEqual({});
    expect(
      refused("you", {
        ...you,
        application: {
          ...you.application,
          contact: { ...contact, linkedin: " https://www.linkedin.com/in/antran " },
        },
      }),
    ).toEqual({});
  });

  it("takes text of spaces as nothing", () => {
    expect(
      refused("you", {
        ...you,
        application: { ...you.application, contact: { ...contact, firstName: "  ", phone: " " } },
      }),
    ).toEqual({
      "application.contact.firstName": "required",
      "application.contact.phone": "phoneRequired",
    });
  });

  it("refuses a number and an address the backend would refuse", () => {
    expect(
      refused("you", {
        ...you,
        application: {
          ...you.application,
          contact: { ...contact, phone: "call me", linkedin: "www.linkedin.com/in/antran" },
        },
      }),
    ).toEqual({
      "application.contact.phone": "phoneRequired",
      "application.contact.linkedin": "linkedinInvalid",
    });
  });

  it("asks a team for its name and its background, and takes a website only as an address", () => {
    const asTeam: ApplyValues = { ...you, who: "team" };

    expect(refused("you", asTeam)).toEqual({
      "team.name": "required",
      "application.teamBackground": "required",
    });
    expect(
      refused("you", {
        ...asTeam,
        team: { name: "Pocket Policy", size: "2_9", website: "pocketpolicy.example" },
        application: { ...asTeam.application, teamBackground: "Two engineers." },
      }),
    ).toEqual({ "team.website": "webAddress" });
    expect(
      refused("you", {
        ...asTeam,
        team: { name: "Pocket Policy", size: "2_9", website: "http://pocketpolicy.example" },
        application: { ...asTeam.application, teamBackground: "Two engineers." },
      }),
    ).toEqual({});
  });

  it("does not ask an individual about a team, whatever the team fields still hold", () => {
    expect(
      refused("you", { ...you, team: { name: "", size: "2_9", website: "not an address" } }),
    ).toEqual({});
  });

  it("keeps a company from continuing until it is joined or added", () => {
    expect(
      refused("you", {
        ...you,
        who: "company",
        application: { ...you.application, teamBackground: "Two engineers." },
      }),
    ).toEqual({ who: "companyRequired" });
    expect(refused("you", { ...you, who: "company" })).toEqual({
      who: "companyRequired",
      "application.teamBackground": "required",
    });
  });

  it("asks someone in an organization nothing about who applies, and a team for its background", () => {
    const member: ApplyValues = { ...you, who: "" };

    expect(refused("you", member, builder)).toEqual({});
    expect(refused("you", member, team)).toEqual({ "application.teamBackground": "required" });
    expect(
      refused(
        "you",
        { ...member, application: { ...member.application, teamBackground: "Two engineers." } },
        team,
      ),
    ).toEqual({});
  });
});

describe("contactShapeSchema, the check made when a field is left", () => {
  const left = (phone: string, linkedin: string) =>
    problemsOf(contactShapeSchema(words), {
      ...you,
      application: { ...you.application, contact: { ...contact, phone, linkedin } },
    });

  it("accepts an empty field and what the backend accepts", () => {
    expect(left("", "")).toBeUndefined();
    expect(left(" (028) 3822-1234 ", "https://www.linkedin.com/in/antran")).toBeUndefined();
  });

  it("refuses a number with letters and an address without https, each on its field", () => {
    expect(left("abc", "http://linkedin.com/in/antran")).toEqual({
      "application.contact.phone": { message: "phoneRequired" },
      "application.contact.linkedin": { message: "linkedinInvalid" },
    });
  });
});

describe("step 2, the solution", () => {
  it("asks for the name, what it does, the problem, the stage and the deck", () => {
    expect(refused("solution", empty)).toEqual({
      "solution.name": "required",
      "solution.summary": "required",
      "solution.problemsSolved": "required",
      "solution.maturity": "maturityRequired",
      "application.deck": "deckRequired",
    });
  });

  it("asks for nothing else: milestones, tools and the demo link are optional", () => {
    expect(
      refused("solution", {
        ...empty,
        solution: {
          id: null,
          name: "Claim Copilot",
          summary: "A chat assistant.",
          problemsSolved: "Drivers wait on a hotline.",
          maturity: "pilot",
          demoUrl: "",
        },
        application: {
          ...empty.application,
          deck: { fileId: "deck-file", fileName: "deck.pdf", sizeBytes: 1 },
        },
      }),
    ).toEqual({});
  });
});

describe("step 3, the program's questions", () => {
  const answered = (answers: Record<string, string>): ApplyValues => ({
    ...empty,
    application: { ...empty.application, answers },
  });

  it("asks for every required question, each kind by its own words, and not for an optional one", () => {
    expect(refused("questions", empty)).toEqual({
      [`application.answers.${text}`]: "answerRequired",
      [`application.answers.${file}`]: "answerRequired",
      [`application.answers.${confirm}`]: "answerConfirmRequired",
      [`application.answers.${choices}`]: "answerChoicesRequired",
    });
  });

  it("asks for a question the stored draft has no answer to at all", () => {
    expect(refused("questions", answered({}))).toHaveProperty(
      [`application.answers.${text}`],
      "answerRequired",
    );
  });

  it("takes spaces as no answer, and any text as one", () => {
    const all = { [text]: "  ", [file]: "file-id", [confirm]: "true", [choices]: '["Claims"]' };

    expect(refused("questions", answered(all))).toEqual({
      [`application.answers.${text}`]: "answerRequired",
    });
    expect(refused("questions", answered({ ...all, [text]: "Claims reach a decision." }))).toEqual(
      {},
    );
  });

  it("lets a stored answer through whose option is gone, and one to a question that is gone", () => {
    expect(
      refused(
        "questions",
        answered({
          [text]: "Claims reach a decision.",
          [file]: "file-id",
          [confirm]: "true",
          [choices]: '["An area no longer offered"]',
          "7c1e0a2b-0000-4000-8000-0000000000aa": "An answer to a question since removed",
        }),
      ),
    ).toEqual({});
  });
});

describe("step 4, review", () => {
  it("asks for the confirmation and nothing else", () => {
    expect(refused("review", empty)).toEqual({ confirmed: "confirmRequired" });
    expect(refused("review", { ...empty, confirmed: true })).toEqual({});
  });
});

describe("what each step still lacks, by its own rules", () => {
  const steps: ApplyStep[] = ["you", "solution", "questions", "review"];
  const solved: ApplyValues = {
    ...you,
    solution: {
      id: null,
      name: "Claim Copilot",
      summary: "A chat assistant.",
      problemsSolved: "Drivers wait on a hotline.",
      maturity: "pilot",
      demoUrl: "",
    },
    application: {
      ...you.application,
      deck: { fileId: "deck-file", fileName: "deck.pdf", sizeBytes: 1 },
    },
  };
  const complete: ApplyValues = {
    ...solved,
    application: {
      ...solved.application,
      answers: {
        [text]: "Claims reach a decision.",
        [file]: "file-id",
        [confirm]: "true",
        [choices]: '["Claims"]',
      },
    },
  };

  it("names the fields of every step at once, whichever step is on the screen", () => {
    const lacking = lackingBy(empty, { organization: null, questions });

    expect(lacking.you).toEqual([
      "who",
      "application.contact.firstName",
      "application.contact.lastName",
      "application.contact.phone",
      "application.contact.country",
    ]);
    expect(lacking.solution).toContain("application.deck");
    expect(lacking.questions).toContain(`application.answers.${confirm}`);
  });

  it("holds the review to nothing of its own: its confirmation is asked on Submit", () => {
    expect(lackingBy(empty, { organization: null, questions }).review).toEqual([]);
  });

  it("asks someone who applies for an organization nothing about who applies", () => {
    expect(lackingBy({ ...you, who: "" }, { organization: builder, questions }).you).toEqual([]);
    expect(lackingBy({ ...you, who: "" }, { organization: team, questions }).you).toEqual([
      "application.teamBackground",
    ]);
  });

  it("lacks nothing in the questions of a program that asks none", () => {
    expect(lackingBy(empty, { organization: null, questions: [] }).questions).toEqual([]);
  });

  it("takes a draft up at the first step that lacks something", () => {
    const at = (values: ApplyValues) =>
      firstUnfinished(steps, lackingBy(values, { organization: builder, questions }));

    expect(at(empty)).toBe(0);
    expect(at(you)).toBe(1);
    expect(at(solved)).toBe(2);
  });

  it("takes a draft that lacks nothing up at the review", () => {
    expect(firstUnfinished(steps, lackingBy(complete, { organization: builder, questions }))).toBe(
      3,
    );
    // A step filled in after one that is not does not move the person past the gap.
    expect(
      firstUnfinished(
        steps,
        lackingBy({ ...complete, solution: empty.solution }, { organization: builder, questions }),
      ),
    ).toBe(1);
  });

  it("counts the steps of a program without questions", () => {
    const short: ApplyStep[] = ["you", "solution", "review"];

    expect(
      firstUnfinished(short, lackingBy(solved, { organization: builder, questions: [] })),
    ).toBe(2);
  });
});
