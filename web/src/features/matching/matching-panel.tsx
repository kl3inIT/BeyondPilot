"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EqualApproximatelyIcon,
  ExternalLinkIcon,
  FileQuestionIcon,
  FileTextIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type {
  GiveMatchingFeedback,
  MatchingCandidate,
  MatchingFinding,
  MatchingRequirement,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { MatchingDeck } from "./matching-deck";
import { MatchingFeedback } from "./matching-feedback";
import { StatusChip, useSourceLine } from "./matching-marks";
import { useCandidateMeta } from "./matching-row";
import { findingOf, openingOf, unreadOf, type Need } from "./matching-view";

/** What of a solution a quote's source opens: its name, its page in the directory, whether it has one. */
type Quoted = Pick<MatchingCandidate, "solutionName" | "solutionSlug" | "listed">;

/**
 * Where a vendor's words come from, as something a reader can open: a page of the deck inside the app
 * with the words highlighted, the page of the website in a new tab, the solution's page for its profile
 * and its customer cases. A source that cannot be opened stays plain text. When code found the words in
 * that source word for word, the line says so with a tick, in the place of "From": that the words are
 * in the vendor's own material, not that what they say is true.
 */
function SourceLine({ finding, solution }: { finding: MatchingFinding; solution: Quoted }) {
  const t = useTranslations("Matching.source");
  const found = finding.quoteState === "exact";
  const text = useSourceLine()(finding.source, found);
  if (!text) {
    return null;
  }
  const opening = openingOf(finding, solution.listed);
  const tick = found && <CheckIcon data-slot="matching-found" aria-hidden="true" />;

  if (opening?.how === "deck") {
    return (
      <MatchingDeck
        solutionName={solution.solutionName}
        solutionSlug={solution.solutionSlug}
        page={opening.page}
        quote={finding.quote}
      >
        {tick || <FileTextIcon aria-hidden="true" />}
        {text}
      </MatchingDeck>
    );
  }
  if (opening?.how === "website") {
    return (
      <TextButton
        size="sm"
        href={opening.href}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-full"
      >
        {tick}
        <span className="truncate">
          {t(found ? "found.websiteAt" : "websiteAt", { host: opening.host })}
        </span>
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    );
  }
  if (opening?.how === "profile") {
    return (
      <TextButton
        size="sm"
        href={`${siteRoutes.solutions}/${solution.solutionSlug}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {tick}
        {text}
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {found && (
        <CheckIcon data-slot="matching-found" aria-hidden="true" className="size-3 shrink-0" />
      )}
      {text}
    </span>
  );
}

type FindingItemProps = {
  /** The requirement in full; absent when the page says it already, as for the one a use case has. */
  statement?: string;
  /** Said beside the verdict of a requirement the use case cannot do without. */
  tag?: string;
  finding: MatchingFinding | undefined;
  solution: Quoted;
};

/**
 * One requirement and what the solution shows of it: the statement in full, the verdict in words, the
 * AI's reason as body text, then the vendor's own words set apart as a quotation with where they come
 * from under it, to open. Words that are only close to the vendor's, most of them there and not all,
 * say so before their source.
 */
function FindingItem({ statement, tag, finding, solution }: FindingItemProps) {
  const t = useTranslations("Matching.source");
  const quote = finding?.quote.trim();
  const reason = finding?.reason.trim();

  return (
    <li className="flex flex-col gap-2">
      {statement && <p className="text-sm font-semibold wrap-break-word">{statement}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={finding?.status ?? "not_shown"} />
        {tag && <Badge variant="secondary">{tag}</Badge>}
      </div>
      {reason && <p className="text-sm">{reason}</p>}
      {finding && quote && (
        <figure className="flex flex-col items-start gap-1 border-l-2 pl-3">
          <blockquote className="text-sm wrap-break-word">
            <q>{quote}</q>
          </blockquote>
          <figcaption className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
            {finding.quoteState === "close" && (
              <span
                data-slot="matching-close"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <EqualApproximatelyIcon aria-hidden="true" className="size-3 shrink-0" />
                {t("close")}
              </span>
            )}
            <SourceLine finding={finding} solution={solution} />
          </figcaption>
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
  /** True while an answer about the group is on its way. */
  answering: boolean;
  /** Says whether the AI put the solution in the right group; resolves to whether it was kept. */
  onFeedback: (body: GiveMatchingFeedback) => Promise<boolean>;
  /** Steps to the solution before or after it in the list; absent at either end. */
  onPrevious?: () => void;
  onNext?: () => void;
  onShortlist: () => void;
  onRemove: () => void;
};

/**
 * One solution read in full, top to bottom: who it is, the AI's summary, each requirement with the
 * vendor's words and where they come from, the conditions of delivery behind a disclosure, whether the
 * group is the right one, and the two decisions. A use case with one requirement says it at the top of the page, so the panel does not say
 * it again, and leaves out the summary when the reason for that one requirement is there. The steps to
 * the solutions around it and the two decisions each have a key, which the board listens for and the
 * controls name in their tooltip.
 */
function MatchingPanel({
  candidate,
  needs,
  constraints,
  pending,
  answering,
  onFeedback,
  onPrevious,
  onNext,
  onShortlist,
  onRemove,
}: MatchingPanelProps) {
  const t = useTranslations("Matching");
  const meta = useCandidateMeta()(candidate);
  const unread = unreadOf(candidate);
  const shortlisted = candidate.decision === "shortlisted";
  /** What a control does and the key that does it too, as its tooltip. */
  const hint = (label: string, key: string) => t("panel.shortcut", { label, key });
  const [onlyNeed] = needs.length === 1 ? needs : [];
  // With one requirement, its reason says what the summary would say.
  const reasoned = onlyNeed && Boolean(findingOf(candidate, onlyNeed.position)?.reason.trim());
  const summary = reasoned ? undefined : candidate.summary?.trim();
  // The deck is there to open only where anyone may read it: at the public address of a listed solution.
  const deckToOpen = candidate.listed && (unread === "deck" || unread === "both");

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
              title={hint(t("panel.previous"), "←")}
              aria-keyshortcuts="ArrowLeft"
              disabled={!onPrevious}
              onClick={onPrevious}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t("panel.next")}
              title={hint(t("panel.next"), "→")}
              aria-keyshortcuts="ArrowRight"
              disabled={!onNext}
              onClick={onNext}
            >
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
        (summary || unread) && (
          <div className="flex flex-col gap-2 border-t pt-5">
            {summary && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{t("panel.aiSummary")}</p>
                <p className="text-sm">{summary}</p>
              </div>
            )}
            {unread && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <FileQuestionIcon aria-hidden="true" className="size-4 shrink-0" />
                  {t(`row.unread.${unread}`)}
                </p>
                {deckToOpen && (
                  <MatchingDeck
                    solutionName={candidate.solutionName}
                    solutionSlug={candidate.solutionSlug}
                    page={1}
                  >
                    {t("panel.openDeck")}
                  </MatchingDeck>
                )}
              </div>
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
                statement={onlyNeed ? undefined : need.statement}
                tag={need.required ? t("panel.required") : undefined}
                finding={findingOf(candidate, need.position)}
                solution={candidate}
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
            <ul className="flex flex-col gap-6 pt-1">
              {constraints.map((constraint) => (
                <FindingItem
                  key={constraint.position}
                  statement={constraint.statement.trim()}
                  finding={findingOf(candidate, constraint.position)}
                  solution={candidate}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {candidate.judged && (
        <MatchingFeedback
          // Another solution, or this one judged anew, is another question.
          key={candidate.id}
          candidate={candidate}
          needs={needs}
          pending={answering}
          onAnswer={onFeedback}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button
          prominence={shortlisted ? "secondary" : "primary"}
          aria-pressed={shortlisted}
          title={hint(t(shortlisted ? "row.shortlisted" : "row.shortlist"), "S")}
          aria-keyshortcuts="S"
          pending={pending}
          onClick={onShortlist}
        >
          {shortlisted && !pending && <CheckIcon aria-hidden="true" />}
          {t(shortlisted ? "row.shortlisted" : "row.shortlist")}
        </Button>
        <Button
          prominence="secondary"
          title={hint(t("row.remove"), "N")}
          aria-keyshortcuts="N"
          disabled={pending}
          onClick={onRemove}
        >
          {t("row.remove")}
        </Button>
      </div>
    </div>
  );
}

export { MatchingPanel };
