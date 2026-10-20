"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TextButton } from "@/components/actions/text-button";
import { PdfOpenButton } from "@/components/composites/pdf-open-button";
import { useFileSize } from "@/features/solution/solution-deck";
import type { ProposingOrganization, SolutionSummary } from "@/lib/api/generated";
import { readableAddress } from "@/lib/storage/uploaded-files";

import type { Details, ProposalValues, Step } from "./proposal-draft";
import { ProposalOrganizationActions } from "./proposal-organization-actions";
import { SentByRows } from "./proposal-sender-card";
import { ownProposalFileAddress } from "./received-proposals";
import { catalogHref, catalogRowProps, ProposalSolutionRow } from "./proposal-solution-list";

type ProposalReviewStepProps = {
  useCaseId: string;
  organization: ProposingOrganization;
  values: ProposalValues;
  catalog: SolutionSummary[];
  /** The submitting identity: what the account says, as it stands. */
  details: Details;
  email: string;
  /** Opens a step to change what it holds. */
  onEdit: (step: Step) => void;
  /** The organization was corrected from here: the proposal reads it again. */
  onOrganized: () => Promise<void>;
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
  useCaseId,
  organization,
  values,
  catalog,
  details,
  email,
  onEdit,
  onOrganized,
}: ProposalReviewStepProps) {
  const t = useTranslations("UseCaseProposal.wizard");
  const upload = useTranslations("PdfUpload");
  const size = useFileSize();
  const empty = <p className="text-sm text-muted-foreground">{t("review.nothing")}</p>;
  const solutions = values.solutionIds.flatMap(
    (id) => catalog.find((solution) => solution.id === id) ?? [],
  );

  return (
    <div className="flex flex-col gap-5">
      <Section step="you" title={t("steps.you")} onEdit={onEdit}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-medium">{organization.name}</p>
          <ProposalOrganizationActions organization={organization} onSaved={onOrganized} />
        </div>
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
        {values.deck ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm">{values.deck.fileName}</p>
            <PdfOpenButton
              url={readableAddress(values.deck.fileId, ownProposalFileAddress(useCaseId)) ?? ""}
              name={values.deck.fileName}
              meta={size(values.deck.sizeBytes)}
              label={upload("open")}
              accessibleLabel={upload("openFile", { name: values.deck.fileName })}
            />
          </div>
        ) : (
          empty
        )}
      </Section>
    </div>
  );
}

export { ProposalReviewStep };
