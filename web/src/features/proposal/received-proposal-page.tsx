import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { TextButton } from "@/components/actions/text-button";
import { useFileSize } from "@/features/solution/solution-deck";
import type { ReceivedUseCaseProposal } from "@/lib/api/generated";
import { adminUseCaseProposalsRoute, siteRoutes, workspaceUseCaseProposalsRoute } from "@/lib/site";
import { cn } from "@/lib/utils";

import { Card, ProposalTeamList, Rows } from "./proposal-card";
import { ProposalSenderCard, ProposalSentBy } from "./proposal-sender-card";
import { ProposalSolutionList } from "./proposal-solution-list";
import { proposalFileAddress } from "./received-proposals";

type ReceivedProposalPageProps = {
  proposal: ReceivedUseCaseProposal;
  /** Whose page it is: the organization's own, or the operators', inside Admin, which decides nothing. */
  area?: "workspace" | "admin";
};

/**
 * One proposal a use case received, read-only: who sent it, the solutions offered and the approach,
 * the sender as they described themselves when they sent it, the team and the PDF. Shortlist and
 * Decline are drawn and disabled for the organization until a later change adds the decision; GenAI
 * Fund reads the proposal without them.
 */
function ReceivedProposalPage({ proposal, area = "workspace" }: ReceivedProposalPageProps) {
  const admin = area === "admin";
  const t = useTranslations("UseCaseProposal.received.detail");
  const format = useFormatter();
  const size = useFileSize();
  const { sender, deck, team, solutions, useCase } = proposal;
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
  const sent = day(proposal.sentAt);
  const edited = proposal.editedAt ? day(proposal.editedAt) : null;
  return (
    <div
      className={cn(
        "flex flex-1 justify-center",
        admin ? "px-4 pt-2 pb-12 md:px-6 lg:px-8" : "bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12",
      )}
    >
      <div className={"flex w-full max-w-220 flex-col gap-5"}>
        <header className="flex flex-col gap-2">
          <nav
            aria-label={t("crumbs")}
            className="flex flex-wrap items-center gap-x-2 text-sm font-medium"
          >
            <TextButton href={admin ? siteRoutes.adminUseCases : siteRoutes.workspaceUseCases}>
              <ArrowLeftIcon aria-hidden="true" />
              {t("useCases")}
            </TextButton>
            <span aria-hidden="true" className="text-muted-foreground">
              ›
            </span>
            <TextButton
              href={
                admin
                  ? adminUseCaseProposalsRoute(useCase.id)
                  : workspaceUseCaseProposalsRoute(useCase.id)
              }
            >
              {useCase.title}
            </TextButton>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">
                {proposal.organizationName}
              </h1>
              {!proposal.organizationApproved && <Badge variant="secondary">{t("pending")}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("sent", { date: sent })}
                {edited && " · " + t("edited", { date: edited })}
              </span>
              {/* The decision comes with a later change: drawn, not offered. */}
              {!admin && (
                <>
                  <Button prominence="secondary" disabled>
                    {t("decline")}
                  </Button>
                  <Button disabled>{t("shortlist")}</Button>
                </>
              )}
            </div>
          </div>
        </header>

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

        {sender ? (
          <ProposalSenderCard sender={sender} title={t("sender.title")} />
        ) : (
          <ProposalSentBy sentBy={proposal.sentBy} title={t("sentBy")} />
        )}

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
