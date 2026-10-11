import type { PdfFile } from "@/components/composites/pdf-upload";
import type { SaveUseCaseProposal, TalentProfile, UseCaseProposal } from "@/lib/api/generated";

/** The steps of the proposal, in the order the member goes through them. */
export const steps = ["organization", "solutions", "profile", "team", "pdf", "review"] as const;
export type Step = (typeof steps)[number];

/** The longest approach the backend takes. */
export const maxApproach = 2000;

/** One person named on the team, with the role typed by hand. */
export type TeamRow = { accountId: string; role: string; primary: boolean };

/** What the member has written, as the wizard holds it and saves it. */
export type ProposalValues = {
  solutionIds: string[];
  approach: string;
  deck: PdfFile | null;
  team: TeamRow[];
};

/** The values a saved proposal holds, or empty ones before anything was saved. */
export function valuesOf(proposal: UseCaseProposal | null | undefined): ProposalValues {
  return {
    solutionIds: proposal?.solutions.map((solution) => solution.id) ?? [],
    approach: proposal?.approach ?? "",
    deck: proposal?.deck
      ? {
          fileId: proposal.deck.fileId,
          fileName: proposal.deck.fileName,
          sizeBytes: proposal.deck.sizeBytes,
        }
      : null,
    team:
      proposal?.team.map((member) => ({
        accountId: member.accountId,
        role: member.role,
        primary: member.primary,
      })) ?? [],
  };
}

/** What the save sends: the values and the version the form last read. */
export function bodyOf(values: ProposalValues, version: number | null): SaveUseCaseProposal {
  return {
    solutionIds: values.solutionIds,
    approach: values.approach,
    deckFileId: values.deck?.fileId ?? null,
    team: values.team.map((member) => ({
      accountId: member.accountId,
      role: member.role,
      primary: member.primary,
    })),
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

/** Adds a person with the role typed; the first person of a team is its primary contact. */
export function addMember(team: TeamRow[], accountId: string, role: string): TeamRow[] {
  if (team.some((member) => member.accountId === accountId)) {
    return team;
  }
  return [...team, { accountId, role: role.trim(), primary: team.length === 0 }];
}

/** Takes a person out; when the primary contact leaves, the first who remains takes the place. */
export function removeMember(team: TeamRow[], accountId: string): TeamRow[] {
  const rest = team.filter((member) => member.accountId !== accountId);
  if (rest.length > 0 && !rest.some((member) => member.primary)) {
    return rest.map((member, index) => ({ ...member, primary: index === 0 }));
  }
  return rest;
}

/** Makes one person the only primary contact. */
export function setPrimary(team: TeamRow[], accountId: string): TeamRow[] {
  return team.map((member) => ({ ...member, primary: member.accountId === accountId }));
}

/** Changes the role typed for one person. */
export function setRole(team: TeamRow[], accountId: string, role: string): TeamRow[] {
  return team.map((member) => (member.accountId === accountId ? { ...member, role } : member));
}

/** Whether the profile has what a proposal needs: a headline, a role, a skill and an about text. */
export function profileComplete(profile: TalentProfile | null | undefined): boolean {
  return !!profile?.complete;
}

/** Whether the team is one a proposal can be sent with: roles filled and exactly one primary contact. */
export function teamComplete(team: TeamRow[]): boolean {
  return (
    team.length > 0 &&
    team.every((member) => member.role.trim() !== "") &&
    team.filter((member) => member.primary).length === 1
  );
}

/**
 * The steps whose content a proposal still lacks, in order. The organization step has nothing to fill
 * and the review step is not content, so neither is ever listed.
 */
export function incompleteSteps(values: ProposalValues, profileIsComplete: boolean): Step[] {
  const missing: Step[] = [];
  if (values.solutionIds.length === 0 || values.approach.trim() === "") {
    missing.push("solutions");
  }
  if (!profileIsComplete) {
    missing.push("profile");
  }
  if (!teamComplete(values.team)) {
    missing.push("team");
  }
  if (!values.deck) {
    missing.push("pdf");
  }
  return missing;
}
