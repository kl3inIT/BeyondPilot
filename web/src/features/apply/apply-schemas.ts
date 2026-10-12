import { z } from "zod";

import type { ApplicationView, FormQuestion } from "@/lib/api/generated";

import { linkedinShape, phoneShape } from "./apply-draft";
import { appliesAlone, type Who } from "./apply-values";

/** The words the schemas' messages are written in; the form passes its translations. */
export type ApplyWords = {
  required: string;
  whoRequired: string;
  companyRequired: string;
  phoneRequired: string;
  countryRequired: string;
  linkedinInvalid: string;
  webAddress: string;
  maturityRequired: string;
  deckRequired: string;
  answerRequired: string;
  answerConfirmRequired: string;
  answerChoicesRequired: string;
  confirmRequired: string;
};

/** The steps of the form that hold something to check. */
export type ApplyStep = "you" | "solution" | "questions" | "review";

/** What a step's rules depend on besides what is typed. */
export type ApplyContext = {
  /** The organization the person applies for; null while they belong to none. */
  organization: ApplicationView["organization"];
  who: Who | "";
  questions: Pick<FormQuestion, "id" | "kind" | "required">[];
};

/** A team's website as the backend takes it (proposal › ApplicantOrganizationRequest). */
const webAddress = /^https?:\/\/\S+$/;

const filled = (message: string) => z.string().trim().min(1, message);

/**
 * A phone number and a LinkedIn address written in a form the backend takes; an empty one is not
 * refused here. A field that fails is left out of the saves made while the person types
 * (`savable`), so each says so when it is left.
 */
export function contactShapes(words: Pick<ApplyWords, "phoneRequired" | "linkedinInvalid">) {
  return {
    phone: z.string().trim().regex(phoneShape, words.phoneRequired),
    linkedin: z
      .string()
      .trim()
      .refine((value) => value === "" || linkedinShape.test(value), words.linkedinInvalid),
  };
}

/**
 * What a step must hold before the person leaves it forward, over what the form holds. Lengths are
 * not checked here: every field stops at the length the backend takes. The backend checks
 * everything again on submission.
 */
export function applyStepSchema(step: ApplyStep, words: ApplyWords, context: ApplyContext) {
  if (step === "you") {
    const shapes = contactShapes(words);
    // Someone in an organization applies for it; anyone else says who applies first.
    const asked = !context.organization;
    return z.object({
      who: asked
        ? z
            .string()
            .min(1, words.whoRequired)
            // A company is joined or added through the finder, which gives the person an organization.
            .refine((who) => who !== "company", words.companyRequired)
        : z.string(),
      team:
        asked && context.who === "team"
          ? z.object({
              name: filled(words.required),
              website: z
                .string()
                .trim()
                .refine((value) => value === "" || webAddress.test(value), words.webAddress),
            })
          : z.unknown(),
      application: z.object({
        contact: z.object({
          firstName: filled(words.required),
          lastName: filled(words.required),
          phone: shapes.phone.min(1, words.phoneRequired),
          country: filled(words.countryRequired),
          linkedin: shapes.linkedin,
        }),
        teamBackground: appliesAlone(context.organization, context.who)
          ? z.string()
          : filled(words.required),
      }),
    });
  }
  if (step === "solution") {
    return z.object({
      solution: z.object({
        name: filled(words.required),
        summary: filled(words.required),
        problemsSolved: filled(words.required),
        maturity: filled(words.maturityRequired),
      }),
      application: z.object({
        deck: z.custom((deck) => Boolean(deck), words.deckRequired),
      }),
    });
  }
  if (step === "questions") {
    return z.object({
      application: z.object({
        answers: z.object(
          Object.fromEntries(
            context.questions
              .filter((question) => question.required)
              .map((question) => [
                question.id,
                // Not an optional text with a rule: zod skips the rules of an optional member that
                // is missing, and a question without a stored answer is the one to ask for.
                z.custom(
                  (answer) => typeof answer === "string" && answer.trim() !== "",
                  question.kind === "confirm"
                    ? words.answerConfirmRequired
                    : question.kind === "multi_choice"
                      ? words.answerChoicesRequired
                      : words.answerRequired,
                ),
              ]),
          ),
        ),
      }),
    });
  }
  return z.object({
    confirmed: z.boolean().refine((confirmed) => confirmed, words.confirmRequired),
  });
}

/**
 * What a schema refuses in what the form holds, by the form's field and the first problem of each;
 * nothing when it refuses nothing.
 */
export function problemsOf(
  schema: z.ZodType,
  values: unknown,
): Record<string, { message: string }> | undefined {
  const issues = schema.safeParse(values).error?.issues;
  if (!issues || issues.length === 0) {
    return undefined;
  }
  const fields: Record<string, { message: string }> = {};
  for (const issue of issues) {
    fields[issue.path.join(".")] ??= { message: issue.message };
  }
  return fields;
}
