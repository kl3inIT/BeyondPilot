"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TextButton } from "@/components/actions/text-button";
import type { ProposingOrganization, SolutionSummary } from "@/lib/api/generated";

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
  onEdit,
}: ProposalReviewStepProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const empty = <p className="text-sm text-muted-foreground">{t("review.nothing")}</p>;
  const solutions = values.solutionIds.flatMap(
    (id) => catalog.find((solution) => solution.id === id) ?? [],
  );

  return (
    <div className="flex flex-col gap-5">
      <Section step="you" title={t("steps.you")} onEdit={onEdit}>
        <p className="text-sm font-medium">{organization.name}</p>
        {organization.type === "builder_team" &&
          (values.teamBackground.trim() ? (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {values.teamBackground}
            </p>
          ) : (
            empty
          ))}
        <SentByRows sentBy={{ ...details, email }} />
      </Section>

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
        {values.deck ? <p className="text-sm">{values.deck.fileName}</p> : empty}
      </Section>
    </div>
  );
}

export { ProposalReviewStep };
