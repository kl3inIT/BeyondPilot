import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useFileSize } from "@/features/solution/solution-deck";
import { useFormatter } from "@/i18n/format";
import type { UseCaseProposal, UseCaseProposalForm } from "@/lib/api/generated";
import { proposeToUseCaseRoute as proposeRoute, siteRoutes, useCaseRoute } from "@/lib/site";

import { Card, ProposalTeamList, Rows } from "./proposal-card";
import { ProposalSentBy } from "./proposal-sender-card";
import { ProposalSolutionList } from "./proposal-solution-list";
import type { EditState } from "./proposal-access";

type ProposalViewPageProps = {
  form: UseCaseProposalForm;
  proposal: UseCaseProposal;
  edit: EditState;
};

/**
 * What the caller's organization sent to a use case, read-only: the organization, the solutions
 * and the approach, the sender's profile as it was sent, the team and the PDF, when it was sent and
 * edited, and the way into editing while the window is open.
 */
function ProposalViewPage({ form, proposal, edit }: ProposalViewPageProps) {
  const t = useTranslations("UseCaseProposal.view");
  const steps = useTranslations("UseCaseProposal.wizard.steps");
  const detail = useTranslations("UseCaseProposal.received.detail");
  const closed = useTranslations("UseCaseProposal.actions.editClosed");
  const size = useFileSize();
  const format = useFormatter();
  const day = (instant: string) => format.dateTime(new Date(instant), "date");
  const { deck } = proposal;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-220 flex-col gap-5">
        <header className="flex flex-col gap-2">
          <nav
            aria-label={detail("crumbs")}
            className="flex flex-wrap items-center gap-x-2 text-sm font-medium"
          >
            <TextButton href={siteRoutes.useCases}>
              <ArrowLeftIcon aria-hidden="true" />
              {detail("useCases")}
            </TextButton>
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            <TextButton href={useCaseRoute(form.useCase.id)}>{form.useCase.title}</TextButton>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">
              {form.organization?.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {proposal.sentAt && t("sent", { date: day(proposal.sentAt) })}
                {proposal.editedAt && ` · ${t("edited", { date: day(proposal.editedAt) })}`}
                {edit.kind === "editable" && ` · ${t("until", { when: day(edit.until) })}`}
              </span>
              {edit.kind === "editable" && (
                <Button href={proposeRoute(form.useCase.id)}>{t("edit")}</Button>
              )}
            </div>
          </div>
          {edit.kind !== "editable" && (
            <p className="text-sm text-muted-foreground">{closed(edit.reason)}</p>
          )}
        </header>

        <Card id="proposal-solutions" title={steps("solutions")}>
          <ProposalSolutionList solutions={proposal.solutions} />
          <Rows
            rows={[
              {
                label: detail("solutions.approach"),
                value: proposal.approach || (
                  <span className="text-muted-foreground">{detail("solutions.noApproach")}</span>
                ),
              },
            ]}
          />
        </Card>

        {proposal.sentBy && <ProposalSentBy sentBy={proposal.sentBy} title={steps("details")} />}

        <Card id="proposal-team" title={steps("team")}>
          <ProposalTeamList team={proposal.team} />
        </Card>

        <Card id="proposal-file" title={steps("pdf")}>
          {deck ? (
            <div className="grid min-w-0 text-sm">
              <span className="truncate font-medium">{deck.fileName}</span>
              <span className="text-muted-foreground">{size(deck.sizeBytes)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{detail("file.none")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

export { ProposalViewPage };
