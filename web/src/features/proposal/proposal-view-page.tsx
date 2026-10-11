import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useFileSize } from "@/features/solution/solution-deck";
import type { UseCaseProposal, UseCaseProposalForm } from "@/lib/api/generated";
import { proposeToUseCaseRoute as proposeRoute, useCaseRoute } from "@/lib/site";

import { Card, ProposalTeamList, Rows } from "./proposal-card";
import { ProposalSenderCard } from "./proposal-sender-card";
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
  const when = (instant: string) =>
    format.dateTime(new Date(instant), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const { deck } = proposal;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-220 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <TextButton href={useCaseRoute(form.useCase.id)} className="self-start">
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </TextButton>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <h1 className="text-3xl font-semibold tracking-tight break-words">{t("title")}</h1>
            {edit.kind === "editable" && (
              <Button href={proposeRoute(form.useCase.id)}>{t("edit")}</Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("meta", { useCase: form.useCase.title })}
            {proposal.sentAt && ` · ${t("sent", { date: when(proposal.sentAt) })}`}
            {proposal.editedAt && ` · ${t("edited", { date: when(proposal.editedAt) })}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {edit.kind === "editable"
              ? t("editUntil", { when: when(edit.until) })
              : closed(edit.reason)}
          </p>
        </div>

        <Card id="proposal-organization" title={steps("organization")}>
          <p className="text-sm">{form.organization?.name}</p>
        </Card>

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

        {proposal.sender && (
          <ProposalSenderCard sender={proposal.sender} title={steps("profile")} />
        )}

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
