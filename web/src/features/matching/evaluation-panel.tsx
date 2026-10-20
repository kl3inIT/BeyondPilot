"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  FileWarningIcon,
  Maximize2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFormatter } from "@/i18n/format";
import { momentText } from "@/i18n/formats";
import type {
  EvaluationCandidate,
  EvaluationCoverage,
  EvaluationEarlier,
  EvaluationFinding,
} from "@/lib/api/generated";

import type { Verdict } from "./evaluation-decide";
import {
  decidable,
  labelTone,
  NOT_OPENED,
  recordDecision,
  recordHref,
  sourceHref,
  tierVariant,
} from "./evaluation-view";

type EvaluationPanelProps = {
  candidate: EvaluationCandidate;
  programId: string;
  /** Whether the program's outcomes were released: an application's decision no longer changes. */
  released: boolean;
  pending: boolean;
  onDecide: (verdict: Verdict) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** The candidate on a page of its own; absent on that page. */
  fullPageHref?: string;
  /** The candidate's earlier assessments, on its own page. */
  earlier?: EvaluationEarlier[];
  /** On the candidate's own page, whose title names it already. */
  standalone?: boolean;
};

/**
 * One candidate read in full, in the order a decision is made: what the AI suggests and why, the
 * decision on its records, then the evidence by criterion with each quote's source, and what was read.
 * The AI's words are a suggestion; the decision is the person's, on the records themselves.
 */
function EvaluationPanel({
  candidate,
  programId,
  released,
  pending,
  onDecide,
  onPrevious,
  onNext,
  fullPageHref,
  earlier,
  standalone = false,
}: EvaluationPanelProps) {
  const t = useTranslations("Matching.evaluation");
  const format = useFormatter();
  const assessment = candidate.assessment;
  const records = decidable(candidate);
  const applicationsLocked = released && records.every((record) => record.kind === "application");

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          {!standalone && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-lg font-semibold wrap-break-word">
                {candidate.organizationName}
              </h2>
              <p className="text-sm wrap-break-word text-muted-foreground">
                {candidate.solutionName}
              </p>
            </div>
          )}
          {(onPrevious || onNext || fullPageHref) && (
            <div className="flex shrink-0 items-center gap-1">
              {(onPrevious || onNext) && (
                <>
                  <IconButton
                    prominence="tertiary"
                    aria-label={t("panel.previous")}
                    disabled={!onPrevious}
                    onClick={onPrevious}
                  >
                    <ChevronLeftIcon aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    prominence="tertiary"
                    aria-label={t("panel.next")}
                    disabled={!onNext}
                    onClick={onNext}
                  >
                    <ChevronRightIcon aria-hidden="true" />
                  </IconButton>
                </>
              )}
              {fullPageHref && (
                <TextButton size="sm" href={fullPageHref} className="ms-1">
                  <Maximize2Icon aria-hidden="true" />
                  {t("panel.fullPage")}
                </TextButton>
              )}
            </div>
          )}
        </div>
        {assessment ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tierVariant[assessment.tier]}>{t(`tiers.${assessment.tier}`)}</Badge>
            {assessment.provisional && <Badge variant="outline">{t("provisional")}</Badge>}
            <span className="text-sm text-muted-foreground">
              {t("alignment.label")}: {t(`alignment.${assessment.alignment}`)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("panel.waiting")}</p>
        )}
        {assessment?.alignmentReason && (
          <p className="text-sm wrap-break-word">{assessment.alignmentReason}</p>
        )}
      </header>

      {candidate.state === "outdated" && <Notice>{t("panel.outdated")}</Notice>}
      {assessment?.instructionsInSources && <Notice>{t("panel.instructions")}</Notice>}
      {assessment?.changeNote && (
        <p className="text-sm">
          <span className="font-medium">{t("panel.changed")}: </span>
          {assessment.changeNote}
        </p>
      )}

      {assessment && (
        <dl className="grid gap-3 text-sm">
          <Note term={t("panel.why")} text={assessment.notes.why} />
          <Note term={t("panel.concern")} text={assessment.notes.concern} />
          <Note term={t("panel.nextStep")} text={assessment.notes.next} />
        </dl>
      )}

      <section
        aria-labelledby="evaluation-decision"
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <h3 id="evaluation-decision" className="text-sm font-semibold">
          {t("panel.decide")}
        </h3>
        <ul className="flex flex-col gap-2">
          {candidate.records.map((record) => {
            const decided = recordDecision(record);
            return (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <TextButton size="sm" href={recordHref(record, programId)}>
                  {record.status === "draft"
                    ? t("records.draft")
                    : record.kind === "application"
                      ? `${t("records.application")}, ${t("records.version", { version: record.version })}`
                      : t("records.proposal")}
                </TextButton>
                {record.status !== "draft" && (
                  <Status
                    appearance="pill"
                    tone={
                      decided === "shortlisted"
                        ? "success"
                        : decided === "not_selected"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t(
                      `records.${recordWords.find((word) => word === record.decision) ?? "undecided"}`,
                    )}
                  </Status>
                )}
              </li>
            );
          })}
        </ul>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("panel.notDecided")}</p>
        ) : (
          !applicationsLocked && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" pending={pending} onClick={() => onDecide("shortlisted")}>
                {t("panel.shortlist")}
              </Button>
              <Button
                size="sm"
                prominence="secondary"
                disabled={pending}
                onClick={() => onDecide("not_selected")}
              >
                {t("panel.notSelected")}
              </Button>
            </div>
          )
        )}
        {!standalone && records.length > 0 && (
          <p className="text-xs text-muted-foreground max-xl:hidden">{t("panel.keys")}</p>
        )}
      </section>

      {assessment && (
        <section aria-labelledby="evaluation-evidence" className="flex flex-col gap-3">
          <h3 id="evaluation-evidence" className="text-sm font-semibold">
            {t("panel.evidence")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(`gate.${assessment.gate.proposal}`)} ·{" "}
            {t(`gate.earlyStage.${assessment.gate.earlyStage}`)}
          </p>
          <ul className="flex flex-col divide-y rounded-lg border">
            {assessment.criteria.map((criterion) => (
              <li key={criterion.key} className="flex flex-col gap-2 p-3">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  {t(`criteria.${criterion.key}`)}
                  {criterion.tractionKind && (
                    <span className="font-normal text-muted-foreground">
                      {t(`traction.${criterion.tractionKind}`)}
                    </span>
                  )}
                </p>
                <ul className="flex flex-col gap-1">
                  {criterion.findings.map((finding, index) => (
                    <li key={index}>
                      <FindingRow finding={finding} candidate={candidate} programId={programId} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment && (
        <dl className="grid gap-3 text-sm">
          <Note term={t("panel.rationale")} text={assessment.notes.rationale} />
          {assessment.notes.questions.length > 0 && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium">{t("panel.questions")}</dt>
              <dd>
                <ol className="list-decimal space-y-1 ps-5">
                  {assessment.notes.questions.map((question) => (
                    <li key={question} className="wrap-break-word">
                      {question}
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          )}
          {assessment.notes.contradictions.length > 0 && (
            <div className="flex flex-col gap-1">
              <dt className="font-medium">{t("panel.contradictions")}</dt>
              <dd>
                <ul className="list-disc space-y-1 ps-5">
                  {assessment.notes.contradictions.map((one) => (
                    <li key={one} className="wrap-break-word">
                      {one}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}

      {assessment && assessment.coverage.length > 0 && (
        <section aria-labelledby="evaluation-coverage" className="flex flex-col gap-2">
          <h3 id="evaluation-coverage" className="text-sm font-semibold">
            {t("panel.coverage")}
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {assessment.coverage.map((read, index) => (
              <li key={index}>
                <CoverageLine read={read} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {assessment && (
        <p className="text-xs text-muted-foreground">
          {t("panel.assessed", {
            when: momentText(format, new Date(assessment.assessedAt)),
            model: assessment.modelName,
          })}
        </p>
      )}

      {earlier && earlier.length > 0 && (
        <section aria-labelledby="evaluation-earlier" className="flex flex-col gap-2">
          <h3 id="evaluation-earlier" className="text-sm font-semibold">
            {t("panel.earlier")}
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {earlier.map((one) => (
              <li key={one.id} className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={tierVariant[one.tier]}>{t(`tiers.${one.tier}`)}</Badge>
                  <span className="text-muted-foreground">
                    {momentText(format, new Date(one.assessedAt))} · {one.modelName}
                  </span>
                </span>
                {one.changeNote && <span className="wrap-break-word">{one.changeNote}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Note({ term, text }: { term: string; text: string }) {
  if (!text) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-medium">{term}</dt>
      <dd className="wrap-break-word">{text}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

/**
 * One finding: its label and short line, and, opened, what it shows, what is missing, and the words
 * quoted with the source they came from. A file's page opens in a new tab at that page.
 */
function FindingRow({
  finding,
  candidate,
  programId,
}: {
  finding: EvaluationFinding;
  candidate: EvaluationCandidate;
  programId: string;
}) {
  const t = useTranslations("Matching.evaluation");
  const href = finding.source ? sourceHref(finding.source, candidate, programId) : undefined;
  const file = href?.startsWith("/api/");

  return (
    <Collapsible>
      <CollapsibleTrigger variant="section">
        <span className="flex min-w-0 flex-1 items-start gap-2 text-sm">
          <Status appearance="pill" tone={labelTone[finding.label]}>
            {t(`labels.${finding.label}`)}
          </Status>
          <span className="min-w-0 flex-1 wrap-break-word">
            {finding.summary || finding.finding}
          </span>
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground group-focus-visible/collapsible-section-trigger:ring-3 group-focus-visible/collapsible-section-trigger:ring-ring/50">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 transition-transform group-aria-expanded/collapsible-section-trigger:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 ps-2 pt-1 pb-2 text-sm">
          {finding.finding && <p className="wrap-break-word">{finding.finding}</p>}
          {finding.lowered && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <FileWarningIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {t("panel.lowered")}
            </p>
          )}
          {finding.gap && !finding.lowered && (
            <p className="wrap-break-word text-muted-foreground">
              <span className="font-medium text-foreground">{t("panel.gap")}: </span>
              {finding.gap}
            </p>
          )}
          {finding.quote && (
            <blockquote className="border-s-2 ps-3 wrap-break-word text-muted-foreground italic">
              {finding.quote}
            </blockquote>
          )}
          {finding.source &&
            (href ? (
              <TextButton
                size="sm"
                href={href}
                {...(file ? { target: "_blank", rel: "noopener" } : {})}
              >
                {finding.source}
                {file && <ExternalLinkIcon aria-hidden="true" />}
              </TextButton>
            ) : (
              <span className="text-xs text-muted-foreground">{finding.source}</span>
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The words a record's own decision is shown by. */
const recordWords = ["under_review", "shortlisted", "not_selected", "declined"] as const;

/** What was read of one record or file: pages read of pages held, and what was not read. */
function CoverageLine({ read }: { read: EvaluationCoverage }) {
  const t = useTranslations("Matching.evaluation.panel");
  if (!read.fileId) {
    return <span className="text-muted-foreground">{read.label}</span>;
  }
  const parts: string[] = [];
  if (read.note) {
    // The backend names a file it could not open in these words, and a repeated file by its label.
    parts.push(read.note === NOT_OPENED ? t("notOpened") : t("sameAs", { label: read.note }));
  } else {
    parts.push(
      read.pages > 40
        ? t("morePages", { read: read.read })
        : t("pages", { read: read.read, pages: read.pages }),
    );
    if (read.unread.length > 0) {
      parts.push(t("unreadPages", { pages: read.unread.join(", ") }));
    }
    if (read.cut) {
      parts.push(t("cut"));
    }
  }
  return (
    <span className="flex flex-col">
      <span className="font-medium wrap-break-word">
        {read.label}
        {read.file && <span className="font-normal text-muted-foreground"> · {read.file}</span>}
      </span>
      <span className="text-muted-foreground">{parts.join(" · ")}</span>
    </span>
  );
}

export { EvaluationPanel };
