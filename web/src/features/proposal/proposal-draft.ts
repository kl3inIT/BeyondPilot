import type { PdfFile } from "@/components/composites/pdf-upload";
import type {
  ProposingOrganization,
  SaveUseCaseProposal,
  UseCaseProposal,
} from "@/lib/api/generated";

import { detailsSchema, PHONE, proposalStepSchemas } from "./proposal-schemas";

/** The rules of the steps without their words, for asking only whether a step is complete. */
const rules = proposalStepSchemas(() => "", { organization: null });
const detailsRule = detailsSchema(() => "");

/** The steps of the proposal, in the order the member goes through them. */
export const steps = ["you", "solutions", "review"] as const;
export type Step = (typeof steps)[number];

/** The longest approach, and the longest account of a team, the backend takes. */
export const maxApproach = 2000;
export const maxBackground = 2000;

/** What the member has written, as the wizard holds it and saves it. */
export type ProposalValues = {
  solutionIds: string[];
  approach: string;
  /** What the team behind it has done; written only by a team. */
  teamBackground: string;
  deck: PdfFile | null;
};

/** The values a saved proposal holds, or empty ones before anything was saved. */
export function valuesOf(proposal: UseCaseProposal | null | undefined): ProposalValues {
  return {
    solutionIds: proposal?.solutions.map((solution) => solution.id) ?? [],
    approach: proposal?.approach ?? "",
    teamBackground: proposal?.teamBackground ?? "",
    deck: proposal?.deck
      ? {
          fileId: proposal.deck.fileId,
          fileName: proposal.deck.fileName,
          sizeBytes: proposal.deck.sizeBytes,
        }
      : null,
  };
}

/** What the save sends: the values and the version the form last read. */
export function bodyOf(values: ProposalValues, version: number | null): SaveUseCaseProposal {
  return {
    solutionIds: values.solutionIds,
    approach: values.approach,
    teamBackground: values.teamBackground,
    deckFileId: values.deck?.fileId ?? null,
    version,
  };
}

/** Adds solutions after the ones chosen; one already chosen stays where it is. */
export function addSolutions(ids: string[], added: string[]): string[] {
  return [...ids, ...added.filter((id, index) => !ids.includes(id) && added.indexOf(id) === index)];
}

/** Takes one solution out of the choice. */
export function removeSolution(ids: string[], id: string): string[] {
  return ids.filter((other) => other !== id);
}

/** The submitting identity the sender gives: the account's name, country and number. */
export type Details = { name: string; country: string; phone: string };

/** Whether the number is written in a form the backend takes. */
export function phoneValid(phone: string): boolean {
  return PHONE.test(phone.trim());
}

/** Whether the details are what a proposal is sent with: a name, a country and a number. */
export function detailsComplete(details: Details): boolean {
  return detailsRule.safeParse(details).success;
}

/**
 * Whether the first step holds what a proposal needs: an organization, the details, and for a team
 * what it has done.
 */
export function youComplete(
  values: ProposalValues,
  details: Details,
  organization: Pick<ProposingOrganization, "type"> | null,
): boolean {
  return (
    organization !== null &&
    detailsComplete(details) &&
    (organization.type !== "builder_team" || values.teamBackground.trim() !== "")
  );
}

/**
 * The steps whose content a proposal still lacks, in order. The review step is not content, so it
 * is never listed. The first step is the person's own, so whether it is complete comes from the
 * caller.
 */
export function incompleteSteps(values: ProposalValues, youDone: boolean): Step[] {
  const missing: Step[] = [];
  if (!youDone) {
    missing.push("you");
  }
  if (!rules.solutions.safeParse(values).success) {
    missing.push("solutions");
  }
  return missing;
}
