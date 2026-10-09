"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate } from "@/lib/api/generated";

type MatchingRemovedProps = {
  candidates: MatchingCandidate[];
  /** Whether the reader is an operator, who restores whatever was removed. */
  operator: boolean;
  /** The candidate a request is on its way for. */
  pendingId: string | null;
  onRestore: (candidate: MatchingCandidate) => void;
};

/**
 * What was removed for this use case: who removed it, why and when, and the way back. Both sides read
 * it. A member restores what members removed; what GenAI Fund removed, only GenAI Fund restores.
 */
function MatchingRemoved({ candidates, operator, pendingId, onRestore }: MatchingRemovedProps) {
  const t = useTranslations("Matching.removed");
  const reasonName = useTranslations("Matching.remove.reasons");
  const format = useFormatter();

  if (candidates.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{t("empty")}</p>
    );
  }

  return (
    <ul className="flex flex-col rounded-xl border bg-card px-2 py-1.5">
      {candidates.map((candidate) => {
        const locked = !operator && candidate.removedByOperator === true;
        const who = candidate.removedByOperator
          ? t("genaiFund")
          : (candidate.removedBy ?? t("someone"));
        const when = candidate.removedAt
          ? format.dateTime(new Date(candidate.removedAt), {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            })
          : "";
        return (
          <li
            key={candidate.id}
            className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <SolutionLogo
                name={candidate.solutionName}
                fileId={candidate.logoFileId}
                size="card"
                className="size-9 rounded-lg text-xs"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{candidate.solutionName}</span>
                <span className="text-sm break-words">
                  {candidate.removedReason && reasonName(candidate.removedReason)}
                  {candidate.removedReason && candidate.removedNote && " · "}
                  {candidate.removedNote}
                </span>
                <span className="text-sm text-muted-foreground">
                  {when ? t("by", { name: who, when }) : t("byOnly", { name: who })}
                </span>
                {locked && <span className="text-sm text-muted-foreground">{t("locked")}</span>}
              </div>
            </div>
            {!locked && (
              <Button
                prominence="secondary"
                size="sm"
                className="self-end sm:self-center"
                pending={pendingId === candidate.id}
                disabled={pendingId !== null}
                onClick={() => onRestore(candidate)}
              >
                {t("restore")}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { MatchingRemoved };
