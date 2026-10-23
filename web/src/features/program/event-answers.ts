import { z } from "zod";

import type { EventAnswer, EventQuestion, RegisterForEvent } from "@/lib/api/generated";
import { chosenOptions } from "@/lib/chosen-options";

// The registration form of an event, built from the questions its host wrote on Luma (BEY-245).
// Luma checks no answer, so the form checks them as the backend does, which checks them again.
// A question that asks the name or the email again is answered from those fields, not shown.

/**
 * The form's values. Each question is held under a key of its position (`k0`, `k1`…): Luma's
 * identifiers may be digits, which the form would read as places in a list.
 */
type EventValues = {
  name: string;
  email: string;
  /** Text, one choice, or several as `answerOfChosen` writes them; the company for a company. */
  answers: Record<string, string>;
  /** The box of an agree-check or terms question. */
  agreed: Record<string, boolean>;
  /** The job title beside a company. */
  jobTitles: Record<string, string>;
};

type Words = {
  required: string;
  tooLong: (max: number) => string;
  invalid: string;
  webAddress: string;
  email: string;
};

const MAX_LINE = 1000;
const MAX_TEXT = 10_000;
const MAX_SHORT = 200;
const PHONE = /^\+?[0-9 ().-]{6,30}$/;
const ADDRESS = /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i;

/** The key a question's values are held under. */
function keyOf(index: number) {
  return `k${index}`;
}

/** The questions the form shows, with the key of each: those not answered from the account. */
function askedQuestions(questions: EventQuestion[]) {
  return questions
    .map((question, index) => ({ question, key: keyOf(index) }))
    .filter(({ question }) => !question.known);
}

function eventDefaults(
  questions: EventQuestion[],
  person?: { name?: string | null; email: string },
): EventValues {
  const answers: Record<string, string> = {};
  const agreed: Record<string, boolean> = {};
  const jobTitles: Record<string, string> = {};
  for (const { question, key } of askedQuestions(questions)) {
    if (question.type === "agree-check" || question.type === "terms") {
      agreed[key] = false;
    } else {
      answers[key] = "";
    }
    if (question.type === "company" && question.jobTitle) {
      jobTitles[key] = "";
    }
  }
  return { name: person?.name ?? "", email: person?.email ?? "", answers, agreed, jobTitles };
}

function textRule(question: EventQuestion, words: Words) {
  const max =
    question.type === "text"
      ? question.multiline
        ? MAX_TEXT
        : MAX_LINE
      : question.type === "url"
        ? 2000
        : MAX_SHORT;
  const filled = z.string().trim().max(max, words.tooLong(max));
  const typed =
    question.type === "url"
      ? filled.refine((value) => !value || ADDRESS.test(value), words.webAddress)
      : question.type === "phone-number"
        ? filled.refine((value) => !value || PHONE.test(value), words.invalid)
        : question.type === "select" && !question.multiple
          ? filled.refine((value) => !value || question.options.includes(value), words.invalid)
          : filled;
  if (!question.required) {
    return typed;
  }
  return question.type === "select" && question.multiple
    ? typed.refine((value) => chosenOptions(value).length > 0, words.required)
    : typed.refine((value) => value.length > 0, words.required);
}

/** The form's rules: the person's name and, for someone not signed in, their address. */
function eventSchema(questions: EventQuestion[], words: Words, askEmail: boolean) {
  const answers: Record<string, z.ZodType<string>> = {};
  const agreed: Record<string, z.ZodType<boolean>> = {};
  const jobTitles: Record<string, z.ZodType<string>> = {};
  for (const { question, key } of askedQuestions(questions)) {
    if (question.type === "agree-check" || question.type === "terms") {
      agreed[key] = question.required
        ? z.boolean().refine((value) => value, words.required)
        : z.boolean();
    } else {
      answers[key] = textRule(question, words);
    }
    if (question.type === "company" && question.jobTitle) {
      const title = z.string().trim().max(MAX_SHORT, words.tooLong(MAX_SHORT));
      jobTitles[key] = question.required
        ? title.refine((value) => value.length > 0, words.required)
        : title;
    }
  }
  return z.object({
    name: z.string().trim().min(1, words.required).max(MAX_SHORT, words.tooLong(MAX_SHORT)),
    email: askEmail ? z.string().trim().pipe(z.email(words.email)) : z.string(),
    // Typed as the values hold them: the keys are the questions', known only when the form is built.
    answers: z.object(answers) as unknown as z.ZodType<
      Record<string, string>,
      Record<string, string>
    >,
    agreed: z.object(agreed) as unknown as z.ZodType<
      Record<string, boolean>,
      Record<string, boolean>
    >,
    jobTitles: z.object(jobTitles) as unknown as z.ZodType<
      Record<string, string>,
      Record<string, string>
    >,
  });
}

/** What the backend is sent: one answer per question answered, in the field its type takes. */
function eventRequest(
  questions: EventQuestion[],
  values: EventValues,
  formVersion: string,
): RegisterForEvent {
  const answers: EventAnswer[] = [];
  for (const { question, key } of askedQuestions(questions)) {
    const said = (values.answers[key] ?? "").trim();
    if (question.type === "agree-check" || question.type === "terms") {
      if (values.agreed[key]) {
        answers.push({ questionId: question.id, agreed: true });
      }
    } else if (question.type === "company") {
      const title = (values.jobTitles[key] ?? "").trim();
      if (said) {
        answers.push({ questionId: question.id, company: said, jobTitle: title || null });
      }
    } else if (question.type === "select" && question.multiple) {
      const chosen = chosenOptions(said);
      if (chosen.length > 0) {
        answers.push({ questionId: question.id, choices: chosen });
      }
    } else if (said) {
      answers.push({ questionId: question.id, text: said });
    }
  }
  return { name: values.name.trim(), formVersion, answers };
}

export { askedQuestions, eventDefaults, eventRequest, eventSchema, type EventValues };
