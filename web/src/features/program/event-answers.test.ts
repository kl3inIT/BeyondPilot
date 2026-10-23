import { describe, expect, it } from "vitest";

import type { EventQuestion } from "@/lib/api/generated";
import { answerOfChosen } from "@/lib/chosen-options";

import { askedQuestions, eventDefaults, eventRequest, eventSchema } from "./event-answers";

const words = {
  required: "required",
  tooLong: (max: number) => `max ${max}`,
  invalid: "invalid",
  webAddress: "address",
  email: "email",
};

function question(partial: Partial<EventQuestion> & Pick<EventQuestion, "id" | "type">) {
  return {
    label: partial.id,
    required: true,
    multiline: false,
    options: [],
    multiple: false,
    jobTitle: false,
    ...partial,
  } satisfies EventQuestion;
}

const questions: EventQuestion[] = [
  question({ id: "q-name", type: "text", known: "name" }),
  question({ id: "q-role", type: "select", options: ["Investor", "Builder"] }),
  question({
    id: "q-topics",
    type: "select",
    options: ["Agents", "Evals"],
    multiple: true,
    required: false,
  }),
  question({ id: "q-company", type: "company", jobTitle: true }),
  question({ id: "q-site", type: "url", required: false }),
  question({ id: "q-terms", type: "terms", termsUrl: "https://genaifund.test/terms.pdf" }),
];

describe("the registration form of a Luma event", () => {
  it("asks only what the account does not answer, each under the key of its place", () => {
    expect(askedQuestions(questions).map(({ question, key }) => `${key} ${question.id}`)).toEqual([
      "k1 q-role",
      "k2 q-topics",
      "k3 q-company",
      "k4 q-site",
      "k5 q-terms",
    ]);
  });

  it("refuses what is missing, a choice not offered, an address that is not one and terms not agreed", () => {
    const values = eventDefaults(questions, { name: "Linh Tran", email: "linh@events.test" });
    values.answers.k1 = "Astronaut";
    values.answers.k4 = "not an address";
    const result = eventSchema(questions, words, false).safeParse(values);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`)).toEqual(
      [
        "answers.k1 invalid",
        "answers.k3 required",
        "answers.k4 address",
        "agreed.k5 required",
        "jobTitles.k3 required",
      ],
    );
  });

  it("sends each answer in the field its type takes, leaving out what was not answered", () => {
    const values = eventDefaults(questions, { name: "Linh Tran", email: "linh@events.test" });
    values.answers.k1 = "Builder";
    values.answers.k2 = answerOfChosen(["Evals", "Agents"]);
    values.answers.k3 = " Plain Cover ";
    values.jobTitles.k3 = "CTO";
    values.agreed.k5 = true;

    expect(eventSchema(questions, words, false).safeParse(values).success).toBe(true);
    expect(eventRequest(questions, values, "v1")).toEqual({
      name: "Linh Tran",
      formVersion: "v1",
      answers: [
        { questionId: "q-role", text: "Builder" },
        { questionId: "q-topics", choices: ["Evals", "Agents"] },
        { questionId: "q-company", company: "Plain Cover", jobTitle: "CTO" },
        { questionId: "q-terms", agreed: true },
      ],
    });
  });

  it("asks a visitor for an address that is one", () => {
    const values = eventDefaults(questions);
    values.name = "Linh";
    values.email = "linh";
    const result = eventSchema(questions, words, true).safeParse(values);

    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("email");
  });
});
