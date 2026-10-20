"use client";

import { CheckIcon, EqualApproximatelyIcon, ExternalLinkIcon, LoaderIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { DataTableRows } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card } from "@/features/proposal/proposal-card";
import { Link } from "@/i18n/navigation";
import type {
  MatchingFinding,
  MatchingRequirement,
  ProposalEvaluation,
  ProposalEvaluations,
} from "@/lib/api/generated";

import { StatusChip, useSourceLine } from "./matching-marks";
import { hostOf, requirementName } from "./matching-view";
import { proposalFindingOf, proposalSourceOf } from "./proposal-evaluation-view";

/**
 * Where the words of a finding come from, as a line under the quote: the proposal, its team, a page
 * of its PDF, or one of the solutions it offers, named. A page of a website is a link that opens in a
 * new tab. When code found the words in that source word for word, the line begins with a tick.
 */
function ProposalSourceLine({
  finding,
  solutionNames,
}: {
  finding: MatchingFinding;
  solutionNames: string[];
}) {
  const t = useTranslations("ProposalEvaluation.source");
  const solutionLine = useSourceLine();
  const found = finding.quoteState === "exact";
  const source = proposalSourceOf(finding.source, solutionNames);
  if (!source) {
    return null;
  }
  const tick = found && (
    <CheckIcon data-slot="matching-found" aria-hidden="true" className="size-3 shrink-0" />
  );
  if (source.kind === "solution" && source.source.kind === "website" && finding.sourceUrl) {
    return (
      <TextButton
        size="sm"
        href={finding.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="max-w-full"
      >
        {tick}
        <span className="truncate">
          {t("ofSolution", {
            solution: source.name,
            from: t(found ? "found.websiteAt" : "websiteAt", {
              host: hostOf(finding.sourceUrl) ?? "",
            }),
          })}
        </span>
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    );
  }
  const text =
    source.kind === "solution"
      ? t("ofSolution", { solution: source.name, from: solutionLine(source.label, found) ?? "" })
      : source.kind === "proposalDeck"
        ? t(found ? "found.proposalDeck" : "proposalDeck", { page: source.page })
        : t(found ? `found.${source.kind}` : source.kind);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {tick}
      {text}
    </span>
  );
}

/** The vendor's words for one requirement, set apart as a quotation with where they come from. */
function ProposalQuote({
  finding,
  solutionNames,
}: {
  finding: MatchingFinding;
  solutionNames: string[];
}) {
  const t = useTranslations("Matching.source");
  const quote = finding.quote.trim();
  if (!quote) {
    return null;
  }
  return (
    <figure className="flex flex-col items-start gap-1 border-l-2 pl-3">
      <blockquote className="text-sm wrap-break-word">
        <q>{quote}</q>
      </blockquote>
      <figcaption className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
        {finding.quoteState === "close" && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <EqualApproximatelyIcon aria-hidden="true" className="size-3 shrink-0" />
            {t("close")}
          </span>
        )}
        <ProposalSourceLine finding={finding} solutionNames={solutionNames} />
      </figcaption>
    </figure>
  );
}

/** One requirement and what the proposal shows of it: the statement, the verdict, the AI's reason and the quote. */
function ProposalFindingItem({
  requirement,
  finding,
  solutionNames,
}: {
  requirement: MatchingRequirement;
  finding: MatchingFinding | undefined;
  solutionNames: string[];
}) {
  const t = useTranslations("Matching.panel");
  const reason = finding?.reason.trim();
  return (
    <li className="flex flex-col gap-2">
      <p className="text-sm font-semibold wrap-break-word">{requirement.statement}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={finding?.status ?? "not_shown"} />
        {requirement.kind === "capability" && requirement.necessity === "required" && (
          <Badge variant="secondary">{t("required")}</Badge>
        )}
      </div>
      {reason && <p className="text-sm">{reason}</p>}
      {finding && <ProposalQuote finding={finding} solutionNames={solutionNames} />}
    </li>
  );
}

/**
 * What the page says in the place of the evidence when there is none to show: no model chosen, the
 * brief not read yet, or the proposal not read yet. Nothing when there is evidence.
 */
function useMissing(
  evaluations: Pick<ProposalEvaluations, "modelChosen" | "requirements">,
  evaluation: Pick<ProposalEvaluation, "state"> | undefined,
): string | null {
  const t = useTranslations("ProposalEvaluation");
  if (evaluation && evaluation.state !== "waiting" && evaluations.requirements.length > 0) {
    return null;
  }
  if (!evaluations.modelChosen) {
    return t("noModel");
  }
  if (evaluations.requirements.length === 0) {
    return t("noBrief");
  }
  return t("waiting");
}

type ProposalEvaluationCardProps = {
  evaluations: ProposalEvaluations;
  proposalId: string;
};

/**
 * How one proposal meets the use case's requirements, on the proposal's page: the AI's one sentence,
 * then each requirement with its verdict, the AI's reason and the vendor's words, the capabilities
 * before the conditions of delivery. A proposal read before its last edit says so; one not read yet
 * says when it will be.
 */
function ProposalEvaluationCard({ evaluations, proposalId }: ProposalEvaluationCardProps) {
  const t = useTranslations("ProposalEvaluation");
  const panel = useTranslations("Matching.panel");
  const evaluation = evaluations.proposals.find((item) => item.proposalId === proposalId);
  const missing = useMissing(evaluations, evaluation);
  const capabilities = evaluations.requirements.filter((item) => item.kind === "capability");
  const constraints = evaluations.requirements.filter((item) => item.kind === "constraint");

  return (
    <Card id="proposal-evaluation" title={t("card.title")}>
      {missing || !evaluation ? (
        <p className="text-sm text-muted-foreground">{missing}</p>
      ) : (
        <>
          {evaluation.state === "outdated" && (
            <p className="text-sm text-muted-foreground">{t("outdated")}</p>
          )}
          {evaluation.unread.includes("proposal_deck") && (
            <p className="text-sm text-muted-foreground">{t("unreadDeck")}</p>
          )}
          {evaluation.summary && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{panel("aiSummary")}</p>
              <p className="text-sm">{evaluation.summary}</p>
            </div>
          )}
          <ul className="flex flex-col gap-5">
            {capabilities.map((requirement) => (
              <ProposalFindingItem
                key={requirement.position}
                requirement={requirement}
                finding={proposalFindingOf(evaluation, requirement.position)}
                solutionNames={evaluation.solutionNames}
              />
            ))}
          </ul>
          {constraints.length > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <h3 className="text-sm font-semibold">{t("card.constraints")}</h3>
              <ul className="flex flex-col gap-5">
                {constraints.map((requirement) => (
                  <ProposalFindingItem
                    key={requirement.position}
                    requirement={requirement}
                    finding={proposalFindingOf(evaluation, requirement.position)}
                    solutionNames={evaluation.solutionNames}
                  />
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("check")}</p>
        </>
      )}
    </Card>
  );
}

type ProposalCompareProps = {
  evaluations: ProposalEvaluations;
  /** The proposals of the tab chosen, in the list's order, each named by its organization. */
  columns: { id: string; name: string; href: string }[];
};

/**
 * The proposals of a tab side by side against the use case's requirements: a row for each requirement,
 * the capabilities first, and a column for each proposal. A cell is the verdict in words and opens the
 * AI's reason and the vendor's words. The first row counts the must-haves each proposal meets. The table
 * scrolls sideways when it does not fit. Nothing is ranked: the columns keep the list's order.
 */
function ProposalCompare({ evaluations, columns }: ProposalCompareProps) {
  const t = useTranslations("ProposalEvaluation");
  const panel = useTranslations("Matching.panel");
  const byId = new Map(evaluations.proposals.map((item) => [item.proposalId, item]));
  const requirements = evaluations.requirements;

  if (!evaluations.modelChosen || requirements.length === 0) {
    return (
      <p className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        {evaluations.modelChosen ? t("noBrief") : t("noModel")}
      </p>
    );
  }

  const mustHaves = {
    id: "must-haves",
    cells: {
      requirement: <span className="font-medium whitespace-normal">{t("compare.mustHaves")}</span>,
      ...Object.fromEntries(
        columns.map((column) => {
          const evaluation = byId.get(column.id);
          return [
            column.id,
            !evaluation || evaluation.state === "waiting" ? (
              <BeingRead key={column.id} />
            ) : (
              t("compare.met", { met: evaluation.requiredMet, total: evaluation.requiredTotal })
            ),
          ];
        }),
      ),
    },
  };
  const rows = requirements.map((requirement) => ({
    id: String(requirement.position),
    cells: {
      requirement: (
        <span className="flex flex-col gap-1 whitespace-normal">
          <span className="font-medium" title={requirement.statement}>
            {requirementName(requirement)}
          </span>
          {requirement.kind === "capability" && requirement.necessity === "required" ? (
            <Badge variant="secondary" className="self-start">
              {panel("required")}
            </Badge>
          ) : (
            requirement.kind === "constraint" && (
              <span className="text-xs text-muted-foreground">{t("compare.constraint")}</span>
            )
          )}
        </span>
      ),
      ...Object.fromEntries(
        columns.map((column) => [
          column.id,
          <CompareCell
            key={column.id}
            evaluation={byId.get(column.id)}
            requirement={requirement}
            proposalName={column.name}
          />,
        ]),
      ),
    },
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("check")}</p>
      <DataTableRows
        surface
        caption={t("compare.caption")}
        columns={[
          { id: "requirement", header: t("compare.requirement"), layout: { width: "lg" } },
          ...columns.map((column) => ({
            id: column.id,
            header: (
              <Link
                href={column.href}
                className="rounded-sm font-semibold whitespace-normal outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {column.name}
              </Link>
            ),
            layout: { width: "lg" as const },
          })),
        ]}
        rows={[mustHaves, ...rows]}
      />
    </div>
  );
}

function BeingRead() {
  const t = useTranslations("ProposalEvaluation");
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <LoaderIcon aria-hidden="true" className="size-4 shrink-0" />
      {t("compare.beingRead")}
    </span>
  );
}

/** One proposal against one requirement: the verdict, which opens the reason and the vendor's words. */
function CompareCell({
  evaluation,
  requirement,
  proposalName,
}: {
  evaluation: ProposalEvaluation | undefined;
  requirement: MatchingRequirement;
  proposalName: string;
}) {
  const t = useTranslations("ProposalEvaluation");
  if (!evaluation || evaluation.state === "waiting") {
    return <BeingRead />;
  }
  const finding = proposalFindingOf(evaluation, requirement.position);
  const status = finding?.status ?? "not_shown";
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("compare.open", {
          proposal: proposalName,
          requirement: requirementName(requirement),
        })}
        className="-mx-1.5 rounded-md px-1.5 py-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
      >
        <StatusChip status={status} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-sm font-semibold">{requirement.statement}</p>
        {evaluation.state === "outdated" && (
          <p className="text-xs text-muted-foreground">{t("outdated")}</p>
        )}
        {finding?.reason.trim() && <p className="text-sm">{finding.reason}</p>}
        {finding && <ProposalQuote finding={finding} solutionNames={evaluation.solutionNames} />}
        {!finding?.reason.trim() && !finding?.quote.trim() && (
          <p className="text-sm text-muted-foreground">{t("compare.nothing")}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { ProposalCompare, ProposalEvaluationCard };
