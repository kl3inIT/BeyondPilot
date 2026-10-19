import { ApiError } from "@/lib/api/client";
import { getUseCaseProposalForm, type UseCaseProposalForm } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** What opening the form of a use case comes to: the form, a refusal the page explains, or nothing. */
export type ProposalFormResult =
  | { kind: "form"; form: UseCaseProposalForm }
  | { kind: "blocked"; reason: "own" | "closed" }
  | { kind: "challenge" }
  | { kind: "absent" };

/** The proposal form of a use case for the person behind this request. Server only. */
export async function readProposalForm(useCaseId: string): Promise<ProposalFormResult> {
  try {
    const { data } = await getUseCaseProposalForm({
      ...(await sessionRequest()),
      path: { useCaseId },
    });
    return { kind: "form", form: data };
  } catch (error) {
    if (error instanceof ApiError) {
      // A use case of a challenge that takes applications is answered by applying to the challenge.
      if (error.code === "PROPOSAL_USE_CASE_IN_CHALLENGE") {
        return { kind: "challenge" };
      }
      if (error.status === 409) {
        return { kind: "blocked", reason: "closed" };
      }
      if (error.status === 403) {
        return { kind: "blocked", reason: "own" };
      }
      if (error.status === 404 || error.status === 400) {
        return { kind: "absent" };
      }
    }
    throw error;
  }
}
