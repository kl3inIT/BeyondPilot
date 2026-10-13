import { ApiError } from "@/lib/api/client";
import type { FailureWords } from "@/lib/api/failure";

import type { ApplyStep } from "./apply-schemas";

/**
 * What the application form says in its own words: where a refusal is met by going on with the form,
 * not by what the general words advise elsewhere.
 */
export const applyWords = {
  ORGANIZATION_ALREADY_MEMBER: "Apply.errors.codes.ORGANIZATION_ALREADY_MEMBER",
  PROPOSAL_CHANGED_MEANWHILE: "Apply.errors.codes.PROPOSAL_CHANGED_MEANWHILE",
  PROPOSAL_SOLUTION_REQUIRED: "Apply.errors.codes.PROPOSAL_SOLUTION_REQUIRED",
} as const satisfies FailureWords;

/** Which of the form's two saves the backend refused: the application's, or the solution's of step 2. */
export type RefusedSave = "application" | "solution";

/** A field of the form the backend refused, and the step it is filled in on. */
export type RefusedField = { name: string; step: ApplyStep };

const solutionFields = new Set(["name", "summary", "problemsSolved", "maturity", "demoUrl"]);

/**
 * The fields of the form a refused save points at, in the order of the steps. Every save sends the
 * whole application, so the field refused may be on a step other than the one shown. A member the
 * form does not hold, such as a part of the solution written elsewhere, names no field.
 */
export function refusedFields(error: unknown, save: RefusedSave): RefusedField[] {
  if (!(error instanceof ApiError)) {
    return [];
  }
  const found = new Map<string, RefusedField>();
  for (const violation of error.violations) {
    const [member = "", inner] = violation.pointer.replace(/^#?\//, "").split("/");
    const field = save === "solution" ? ofSolution(member) : ofApplication(member, inner);
    if (field) {
      found.set(field.name, field);
    }
  }
  const order: ApplyStep[] = ["you", "solution", "questions", "review"];
  return [...found.values()].sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));
}

function ofSolution(member: string): RefusedField | null {
  return solutionFields.has(member) ? { name: `solution.${member}`, step: "solution" } : null;
}

function ofApplication(member: string, inner: string | undefined): RefusedField | null {
  switch (member) {
    case "contact":
      return inner ? { name: `application.contact.${inner}`, step: "you" } : null;
    case "teamBackground":
      return { name: "application.teamBackground", step: "you" };
    case "traction":
    case "builtWith":
      return { name: `application.${member}`, step: "solution" };
    case "deckFileId":
      return { name: "application.deck", step: "solution" };
    case "answers":
      return inner ? { name: `application.answers.${inner}`, step: "questions" } : null;
    default:
      return null;
  }
}
