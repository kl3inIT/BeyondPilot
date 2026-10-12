import { z } from "zod";

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (key: "solution" | "approach" | "required" | "phoneInvalid" | "role" | "deck") => string;

/** A number as the backend takes it: digits with spaces, brackets, dots or dashes, and a leading plus. */
export const PHONE = /^\+?[0-9 ().-]*$/;

/** A number written in a form the backend takes; an empty one is not refused here. */
export function phoneSchema(say: Say) {
  return z.string().trim().regex(PHONE, say("phoneInvalid"));
}

/**
 * What each step of a proposal must hold before the next one opens, over what the wizard's form
 * holds. The organization step has nothing to fill and the review step is not content, so neither
 * has rules.
 */
export function proposalStepSchemas(say: Say) {
  return {
    solutions: z.object({
      solutionIds: z.array(z.unknown()).min(1, say("solution")),
      approach: z.string().trim().min(1, say("approach")),
    }),
    details: z.object({
      details: z.object({
        name: z.string().trim().min(1, say("required")),
        country: z.string().min(1, say("required")),
        phone: phoneSchema(say).min(1, say("required")),
      }),
    }),
    // No team, or roles filled and exactly one primary contact; the catalog has no words for the latter.
    team: z.object({
      team: z
        .array(z.looseObject({ role: z.string().trim().min(1, say("role")) }))
        // Without words: zod would put its own in their place, so the rule is marked instead.
        .refine((team) => team.length === 0 || team.filter((row) => row.primary).length === 1, {
          params: { wordless: true },
        }),
    }),
    pdf: z.object({ deck: z.custom((deck) => Boolean(deck), say("deck")) }),
  };
}

type StepSchemas = ReturnType<typeof proposalStepSchemas>;

/**
 * What a step refuses in what the form holds, by the form's field and the first problem of each;
 * nothing when the step may be left. The team is one field, whatever row the problem is in.
 */
export function stepProblems(
  schemas: StepSchemas,
  step: string,
  values: unknown,
): Record<string, { message: string }> | undefined {
  const issues =
    step in schemas
      ? schemas[step as keyof StepSchemas].safeParse(values).error?.issues
      : undefined;
  if (!issues || issues.length === 0) {
    return undefined;
  }
  const fields: Record<string, { message: string }> = {};
  for (const issue of issues) {
    const name = issue.path[0] === "team" ? "team" : issue.path.join(".");
    const wordless = issue.code === "custom" && issue.params?.wordless === true;
    fields[name] ??= { message: wordless ? "" : issue.message };
  }
  return fields;
}
