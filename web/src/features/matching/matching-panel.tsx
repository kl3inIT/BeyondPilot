"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileQuestionIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate, MatchingFinding, MatchingRequirement } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { StatusChip, useSourceLine } from "./matching-marks";
import { useCandidateMeta } from "./matching-row";
import { findingOf, unreadOf, type Need } from "./matching-view";

type FindingItemProps = {
  /** The thing asked for, in full. */
  statement: string;
  /** Said under the statement of a thing the use case cannot do without. */
  tag?: string;
  finding: MatchingFinding | undefined;
};

/**
 * One thing asked for and what the solution shows of it: the statement in full, the verdict in words,
 * the AI's reason as body text, then the vendor's own words set apart as a quotation with where they
 * come from under it.
 */
function FindingItem({ statement, tag, finding }: FindingItemProps) {
  const sourceLine = useSourceLine();
  const quote = finding?.quote.trim();
  const reason = finding?.reason.trim();
  const source = finding && quote ? sourceLine(finding.source) : undefined;

  return (
    <li className="flex flex-col gap-2">
      <p className="text-sm font-semibold wrap-break-word">{statement}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={finding?.status ?? "not_shown"} />
        {tag && <Badge variant="secondary">{tag}</Badge>}
      </div>
      {reason && <p className="text-sm">{reason}</p>}
      {quote && (
        <figure className="flex flex-col gap-1 border-l-2 pl-3">
          <blockquote className="text-sm wrap-break-word">
            <q>{quote}</q>
          </blockquote>
          {source && <figcaption className="text-xs text-muted-foreground">{source}</figcaption>}
        </figure>
      )}
    </li>
  );
}

type MatchingPanelProps = {
  candidate: MatchingCandidate;
  needs: Need[];
  constraints: MatchingRequirement[];
  pending: boolean;
  /** Steps to the solution before or after it in the list; absent at either end. */
  onPrevious?: () => void;
  onNext?: () => void;
  onShortlist: () => void;
  onRemove: () => void;
};

/**
 * One solution read in full, top to bottom: who it is, the AI's verdict and summary, each thing asked
 * for with the vendor's words, the conditions of delivery behind a disclosure, and the two decisions.
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
  const summary = candidate.summary?.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SolutionLogo
            name={candidate.solutionName}
            fileId={candidate.logoFileId}
            size="card"
            className="size-10 rounded-lg text-xs"
          />
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
        {/* The name has the whole width of the panel, so a word breaks only when it is longer than a line. */}
        <div className="flex flex-col items-start gap-1">
          <h2 className="text-lg font-semibold wrap-break-word">{candidate.solutionName}</h2>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
          {candidate.listed && (
            <TextButton href={`${siteRoutes.solutions}/${candidate.solutionSlug}`}>
              {t("row.open")}
              <ExternalLinkIcon aria-hidden="true" />
            </TextButton>
          )}
        </div>
      </div>

      {candidate.judged ? (
        (candidate.bucket !== "none" || summary || unread) && (
          <div className="flex flex-col gap-2 border-t pt-5">
            {candidate.bucket !== "none" && (
              <p className="text-base font-semibold">{t(`groups.${candidate.bucket}.title`)}</p>
            )}
            {summary && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{t("panel.aiSummary")}</p>
                <p className="text-sm">{summary}</p>
              </div>
            )}
            {unread && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <FileQuestionIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {t(`panel.unread.${unread}`)}
              </p>
            )}
          </div>
        )
      ) : (
        <p className="border-t pt-5 text-sm text-muted-foreground">{t("panel.waiting")}</p>
      )}

      {candidate.judged && needs.length > 0 && (
        <section className="flex flex-col gap-4 border-t pt-5">
          <h3 className="text-base font-semibold">{t("panel.needs")}</h3>
          <ul className="flex flex-col gap-6">
            {needs.map((need) => (
              <FindingItem
                key={need.position}
                statement={need.statement}
                tag={need.required ? t("panel.required") : undefined}
                finding={findingOf(candidate, need.position)}
              />
            ))}
          </ul>
        </section>
      )}

      {candidate.judged && constraints.length > 0 && (
        <Collapsible render={<section className="flex flex-col border-t pt-5" />}>
          <h3 className="text-base font-semibold">{t("panel.constraints")}</h3>
          <CollapsibleTrigger variant="section">
            <span className="text-sm font-medium text-primary">
              {t("panel.constraintsCount", { count: constraints.length })}
            </span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground group-focus-visible/collapsible-section-trigger:ring-3 group-focus-visible/collapsible-section-trigger:ring-ring/50">
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 transition-transform group-aria-expanded/collapsible-section-trigger:rotate-180 motion-reduce:transition-none"
              />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-4 pt-1">
              <p className="text-sm text-muted-foreground">{t("panel.constraintsLead")}</p>
              <ul className="flex flex-col gap-6">
                {constraints.map((constraint) => (
                  <FindingItem
                    key={constraint.position}
                    statement={constraint.statement.trim()}
                    finding={findingOf(candidate, constraint.position)}
                  />
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
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
      </div>
    </div>
  );
}

export { MatchingPanel };
