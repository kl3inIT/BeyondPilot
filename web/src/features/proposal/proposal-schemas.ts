import { z } from "zod";

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (
  key: "solution" | "approach" | "required" | "phoneInvalid" | "deck" | "company" | "background",
) => string;

/** A number as the backend takes it: digits with spaces, brackets, dots or dashes, and a leading plus. */
export const PHONE = /^\+?[0-9 ().-]*$/;

/** A number written in a form the backend takes; an empty one is not refused here. */
export function phoneSchema(say: Say) {
  return z.string().trim().regex(PHONE, say("phoneInvalid"));
}

/** What the account keeps of the person who sends: a name, a country and a number. */
export function detailsSchema(say: Say) {
  return z.object({
    name: z.string().trim().min(1, say("required")),
    country: z.string().min(1, say("required")),
    phone: phoneSchema(say).min(1, say("required")),
  });
}

/** What the rules of the first step depend on: the organization the person is in, if any. */
type YouContext = {
  /** The caller's organization, and whether it is a team, which says what it has done. */
  organization: { team: boolean } | null;
};

/**
 * What each step of a proposal must hold before the next one opens, over what the wizard's form
 * holds. The review step is not content, so it has no rules.
 */
export function proposalStepSchemas(say: Say, context: YouContext) {
  return {
    you: z
      .object({
        teamBackground: z.string(),
        details: detailsSchema(say),
      })
      .superRefine((value, ctx) => {
        const { organization } = context;
        const team = organization?.team ?? false;
        if (!organization) {
          ctx.addIssue({ code: "custom", path: ["organization"], message: say("company") });
        }
        if (team && value.teamBackground.trim() === "") {
          ctx.addIssue({ code: "custom", path: ["teamBackground"], message: say("background") });
        }
      }),
    solutions: z.object({
      solutionIds: z.array(z.unknown()).min(1, say("solution")),
      approach: z.string().trim().min(1, say("approach")),
      deck: z.custom((deck) => Boolean(deck), say("deck")),
    }),
  };
}

type StepSchemas = ReturnType<typeof proposalStepSchemas>;

/**
 * What a step refuses in what the form holds, by the form's field and the first problem of each;
 * nothing when the step may be left.
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
    fields[issue.path.join(".")] ??= { message: issue.message };
  }
  return fields;
}
