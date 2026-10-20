"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useNotify } from "@/hooks/use-notify";
import {
  decideApplications,
  decideUseCaseProposal,
  type EvaluationCandidate,
  type EvaluationRecord,
} from "@/lib/api/generated";

import { decidable } from "./evaluation-view";

export type Verdict = "shortlisted" | "not_selected";

/** The decision a record takes for a verdict: a proposal is declined where an application is not selected. */
function decisionFor(record: EvaluationRecord, verdict: Verdict) {
  return record.kind === "proposal" && verdict === "not_selected" ? "declined" : verdict;
}

/** What a record was decided as, on the verdict scale; null while undecided. */
function verdictOf(record: EvaluationRecord): Verdict | null {
  if (record.decision === "shortlisted") {
    return "shortlisted";
  }
  return record.decision === "not_selected" || record.decision === "declined"
    ? "not_selected"
    : null;
}

/**
 * Decides on a candidate through the records' own requests: its submitted application through the
 * program's decisions, each proposal through the use case's. The board adds no decision of its own.
 * A decision that changed earlier ones offers Undo, which puts each back; a first decision has no
 * undecided state to return to, and is changed by deciding again.
 */
function useEvaluationDecide(programId: string) {
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function send(
    records: EvaluationRecord[],
    verdicts: (record: EvaluationRecord) => Verdict,
  ) {
    const applications = records.filter((record) => record.kind === "application");
    const byVerdict = (verdict: Verdict) =>
      applications.filter((record) => verdicts(record) === verdict).map((record) => record.id);
    for (const verdict of ["shortlisted", "not_selected"] as const) {
      const ids = byVerdict(verdict);
      if (ids.length > 0) {
        await decideApplications({
          path: { programId },
          body: { applicationIds: ids, decision: verdict, reason: null },
        });
      }
    }
    for (const record of records.filter((one) => one.kind === "proposal")) {
      await decideUseCaseProposal({
        path: { id: record.id },
        body: { decision: decisionFor(record, verdicts(record)) as "shortlisted" | "declined" },
      });
    }
  }

  async function decide(candidate: EvaluationCandidate, verdict: Verdict): Promise<void> {
    const records = decidable(candidate).filter((record) => verdictOf(record) !== verdict);
    if (records.length === 0) {
      return;
    }
    const key = `${candidate.organizationId}/${candidate.solutionId}`;
    setPending(key);
    try {
      await send(records, () => verdict);
      const before = new Map(records.map((record) => [record.id, verdictOf(record)]));
      const undoable = [...before.values()].every((one) => one !== null);
      notify.success(
        `Matching.evaluation.done.${verdict}`,
        { name: candidate.organizationName },
        undoable
          ? {
              undo: () =>
                void send(records, (record) => before.get(record.id) as Verdict)
                  .then(() => router.refresh())
                  .catch((error: unknown) => notify.failure(error)),
            }
          : undefined,
      );
      router.refresh();
    } catch (error) {
      notify.failure(error);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return { decide, pending };
}

export { useEvaluationDecide };
