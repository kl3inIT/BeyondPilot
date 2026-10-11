import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFileSize } from "@/features/solution/solution-deck";
import type { ReceivedUseCaseProposal } from "@/lib/api/generated";
import { workspaceUseCaseProposalsRoute } from "@/lib/site";

import { Card, ProposalTeamList, Rows } from "./proposal-card";
import { ProposalSenderCard } from "./proposal-sender-card";
import { ProposalSolutionList } from "./proposal-solution-list";
import { proposalFileAddress } from "./received-proposals";

type ReceivedProposalPageProps = {
  proposal: ReceivedUseCaseProposal;
};

/**
 * One proposal a use case received, read-only: who sent it, the solutions offered and the approach,
 * the sender as they described themselves when they sent it, the team and the PDF. Shortlist and
 * Decline are drawn and disabled until a later change adds the decision.
 */
function ReceivedProposalPage({ proposal }: ReceivedProposalPageProps) {
  const t = useTranslations("UseCaseProposal.received.detail");
  const format = useFormatter();
  const size = useFileSize();
  const { sender, deck, team, solutions, useCase } = proposal;
  const sent = format.dateTime(new Date(proposal.sentAt), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const edited = proposal.editedAt
    ? format.dateTime(new Date(proposal.editedAt), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : null;
  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-220 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <TextButton href={workspaceUseCaseProposalsRoute(useCase.id)} className="self-start">
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </TextButton>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <OrganizationMark
                name={proposal.organizationName}
                logoFileId={proposal.organizationLogoFileId}
              />
              <h1 className="text-3xl font-semibold tracking-tight break-words">
                {proposal.organizationName}
              </h1>
            </div>
            {/* The decision comes with a later change: drawn, not offered. */}
            <div className="flex items-center gap-3">
              <Button prominence="secondary" disabled>
                {t("decline")}
              </Button>
              <Button disabled>{t("shortlist")}</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("meta", { useCase: useCase.title, sent })}
            {edited && " · " + t("edited", { date: edited })}
          </p>
        </div>

        <Card id="proposal-solutions" title={t("solutions.title")}>
          <ProposalSolutionList solutions={solutions} />
          <Rows
            rows={[
              {
                label: t("solutions.approach"),
                value: proposal.approach || (
                  <span className="text-muted-foreground">{t("solutions.noApproach")}</span>
                ),
              },
            ]}
          />
        </Card>

        {sender && <ProposalSenderCard sender={sender} title={t("sender.title")} />}

        <Card id="proposal-team" title={t("team.title")}>
          <ProposalTeamList team={team} />
        </Card>

        <Card id="proposal-file" title={t("file.title")}>
          {deck ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid min-w-0 text-sm">
                <span className="truncate font-medium">{deck.fileName}</span>
                <span className="text-muted-foreground">{size(deck.sizeBytes)}</span>
              </div>
              <TextButton href={proposalFileAddress(proposal.id)}>
                <DownloadIcon aria-hidden="true" />
                {t("file.download")}
              </TextButton>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("file.none")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

export { ReceivedProposalPage };
