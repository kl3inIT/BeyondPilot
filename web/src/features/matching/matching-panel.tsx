"use client";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FileQuestionIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate, MatchingFinding, MatchingRequirement } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { SourceChip, StatusChip } from "./matching-marks";
import { useCandidateMeta } from "./matching-row";
import { findingOf, requirementName, unreadOf, type Need } from "./matching-view";

type FindingItemProps = {
  name: string;
  /** Said beside the name of a need the use case cannot do without. */
  note?: string;
  finding: MatchingFinding | undefined;
};

/** What a candidate's material shows of one requirement: the verdict, the words, where they stand and why. */
function FindingItem({ name, note, finding }: FindingItemProps) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-medium">
          {name}
          {note && <span className="ml-2 text-xs font-normal text-muted-foreground">{note}</span>}
        </span>
        <StatusChip status={finding?.status ?? "not_shown"} />
      </div>
      {finding && finding.quote.trim() !== "" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <q className="text-sm text-muted-foreground">{finding.quote}</q>
          <SourceChip source={finding.source} />
        </div>
      )}
      {finding && finding.reason.trim() !== "" && (
        <p className="text-xs text-muted-foreground">{finding.reason}</p>
      )}
    </li>
  );
}

type MatchingPanelProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  constraints: MatchingRequirement[];
  pending: boolean;
  /** Steps to the candidate before or after it in the list; absent at either end. */
  onPrevious?: () => void;
  onNext?: () => void;
  onShortlist: () => void;
  onRemove: () => void;
};

/**
 * One candidate read in full: why it is in its group, each need with the words of the solution's own
 * material, and the conditions of delivery, which a person confirms with the vendor.
 */
function MatchingPanel({
  candidate,
  needs,
  constraints,
  pending,
  onPrevious,
  onNext,
  onShortlist,
  onRemove,
}: MatchingPanelProps) {
  const t = useTranslations("Matching");
  const meta = useCandidateMeta()(candidate);
  const unread = unreadOf(candidate);
  const shortlisted = candidate.decision === "shortlisted";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <SolutionLogo
          name={candidate.solutionName}
          fileId={candidate.logoFileId}
          size="card"
          className="size-10 rounded-lg text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-base font-semibold break-words">{candidate.solutionName}</h2>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            size="sm"
            aria-label={t("panel.previous")}
            disabled={!onPrevious}
            onClick={onPrevious}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </IconButton>
          <IconButton size="sm" aria-label={t("panel.next")} disabled={!onNext} onClick={onNext}>
            <ChevronRightIcon aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {candidate.judged ? (
        <p className="rounded-xl bg-sky p-3 text-sm font-medium text-sky-foreground">
          {candidate.bucket !== "none" && t(`groups.${candidate.bucket}.title`)}
          {candidate.bucket !== "none" && candidate.summary && " · "}
          {candidate.summary}
        </p>
      ) : (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t("panel.waiting")}
        </p>
      )}

      {unread.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileQuestionIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t(
            unread.includes("deck") && unread.includes("website")
              ? "panel.unread.both"
              : unread.includes("deck")
                ? "panel.unread.deck"
                : "panel.unread.website",
          )}
        </p>
      )}

      {candidate.judged && needs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t("panel.needs")}</h3>
          <ul className="flex flex-col gap-4">
            {needs.map((need) => (
              <FindingItem
                key={need.position}
                name={need.name}
                note={need.required ? t("panel.required") : undefined}
                finding={findingOf(candidate, need.position)}
              />
            ))}
          </ul>
        </section>
      )}

      {candidate.judged && constraints.length > 0 && (
        <section className="flex flex-col gap-3 border-t pt-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t("panel.constraints")}</h3>
            <p className="text-xs text-muted-foreground">{t("panel.constraintsLead")}</p>
          </div>
          <ul className="flex flex-col gap-4">
            {constraints.map((constraint) => (
              <FindingItem
                key={constraint.position}
                name={requirementName(constraint)}
                finding={findingOf(candidate, constraint.position)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button
          prominence={shortlisted ? "secondary" : "primary"}
          aria-pressed={shortlisted}
          pending={pending}
          onClick={onShortlist}
        >
          {shortlisted && !pending && <CheckIcon aria-hidden="true" />}
          {t(shortlisted ? "row.shortlisted" : "row.shortlist")}
        </Button>
        <Button prominence="secondary" disabled={pending} onClick={onRemove}>
          {t("row.remove")}
        </Button>
        {candidate.listed && (
          <Button prominence="tertiary" href={`${siteRoutes.solutions}/${candidate.solutionSlug}`}>
            {t("row.open")}
          </Button>
        )}
      </div>
    </div>
  );
}

export { MatchingPanel };
