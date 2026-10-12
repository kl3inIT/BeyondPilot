"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Person } from "@/components/composites/person";
import { TextButton } from "@/components/actions/text-button";
import type { ProposingOrganization, SolutionSummary, TeamCandidate } from "@/lib/api/generated";

import type { Details, ProposalValues, Step } from "./proposal-draft";
import { SentByRows } from "./proposal-sender-card";
import { catalogHref, catalogRowProps, ProposalSolutionRow } from "./proposal-solution-list";

type ProposalReviewStepProps = {
  organization: ProposingOrganization;
  values: ProposalValues;
  catalog: SolutionSummary[];
  /** The submitting identity: what the account says, as it stands. */
  details: Details;
  email: string;
  members: TeamCandidate[];
  /** Opens a step to change what it holds. */
  onEdit: (step: Step) => void;
};

type SectionProps = {
  step: Step;
  title: string;
  onEdit: (step: Step) => void;
  children: ReactNode;
};

function Section({ step, title, onEdit, children }: SectionProps) {
  const t = useTranslations("UseCaseProposal.wizard.review");

  return (
    <section aria-label={title} className="flex flex-col gap-2 border-b pb-5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <TextButton onClick={() => onEdit(step)}>
          {t("edit")}
          <span className="sr-only"> {title}</span>
        </TextButton>
      </div>
      {children}
    </section>
  );
}

/** What the proposal holds, step by step, each with the way back to change it. */
function ProposalReviewStep({
  organization,
  values,
  catalog,
  details,
  email,
  members,
  onEdit,
}: ProposalReviewStepProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const empty = <p className="text-sm text-muted-foreground">{t("review.nothing")}</p>;
  const none = <p className="text-sm text-muted-foreground">{t("review.none")}</p>;
  const solutions = values.solutionIds.flatMap(
    (id) => catalog.find((solution) => solution.id === id) ?? [],
  );

  return (
    <div className="flex flex-col gap-5">
      <Section step="solutions" title={t("steps.solutions")} onEdit={onEdit}>
        {solutions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {solutions.map((solution) => (
              <li key={solution.id}>
                <ProposalSolutionRow
                  {...catalogRowProps(solution, organization.logoFileId)}
                  href={catalogHref(solution)}
                />
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
        {values.approach.trim() ? (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{values.approach}</p>
        ) : (
          empty
        )}
      </Section>

      <Section step="details" title={t("steps.details")} onEdit={onEdit}>
        <SentByRows sentBy={{ ...details, email }} />
      </Section>

      <Section step="team" title={t("steps.team")} onEdit={onEdit}>
        {values.team.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {values.team.map((row) => {
              const person = members.find((member) => member.accountId === row.accountId);
              return (
                <li key={row.accountId} className="flex items-center justify-between gap-3">
                  <Person name={person?.name ?? null} email={person?.email ?? ""} />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {row.role}
                    {row.primary && ` · ${t("review.primary")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          none
        )}
      </Section>

      <Section step="pdf" title={t("steps.pdf")} onEdit={onEdit}>
        {values.deck ? <p className="text-sm">{values.deck.fileName}</p> : empty}
      </Section>
    </div>
  );
}

export { ProposalReviewStep };
