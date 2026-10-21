import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PdfOpenButton } from "@/components/composites/pdf-open-button";
import { Status } from "@/components/composites/status";
import { ReviewStatus } from "@/components/composites/review-status";
import { TextButton } from "@/components/actions/text-button";
import { useFileSize } from "@/features/solution/solution-deck";
import { useFormatter } from "@/i18n/format";
import type { ReceivedUseCaseProposal } from "@/lib/api/generated";
import { adminUseCaseProposalsRoute, siteRoutes, workspaceUseCaseProposalsRoute } from "@/lib/site";
import { cn } from "@/lib/utils";

import { Card, Rows } from "./proposal-card";
import { DecideButtons } from "./proposal-decision";
import { ProposalSentBy } from "./proposal-sender-card";
import { ProposalSolutionList } from "./proposal-solution-list";
import { decisionTone, proposalFileAddress } from "./received-proposals";

type ReceivedProposalPageProps = {
  proposal: ReceivedUseCaseProposal;
  /** Whose page it is: the organization's own, or the operators', who decide for it as well. */
  area?: "workspace" | "admin";
  /** How the proposal meets the use case's requirements, as the AI read it; shown under the decision. */
  evaluation?: React.ReactNode;
};

/**
 * One proposal a use case received: who sent it, the solutions offered and the approach, the
 * sender's name, address, country and number, the team and the PDF; what the team decided about it,
 * with the buttons that decide; and, given one, how it meets the use case's requirements.
 */
function ReceivedProposalPage({
  proposal,
  area = "workspace",
  evaluation,
}: ReceivedProposalPageProps) {
  const admin = area === "admin";
  const t = useTranslations("UseCaseProposal.received.detail");
  const r = useTranslations("UseCaseProposal.received");
  const format = useFormatter();
  const size = useFileSize();
  const { deck, solutions, useCase } = proposal;
  const day = (instant: string) => format.dateTime(new Date(instant), "date");
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
            className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-medium"
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
              {admin && !proposal.organizationApproved && (
                <ReviewStatus state="suspended" appearance="pill">
                  {t("takenDown")}
                </ReviewStatus>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("sent", { date: sent })}
                {edited && " · " + t("edited", { date: edited })}
              </span>
              <DecideButtons
                proposalId={proposal.id}
                name={proposal.organizationName}
                decision={proposal.decision}
              />
            </div>
          </div>
        </header>

        <Card id="proposal-assessment" title={t("assessment.title")}>
          <Rows
            rows={[
              {
                label: t("assessment.decision"),
                value: (
                  <Status tone={decisionTone(proposal.decision)}>
                    {r(`status.${proposal.decision ?? "undecided"}`)}
                  </Status>
                ),
              },
              ...(proposal.decision && proposal.decidedAt
                ? [
                    {
                      label: t("assessment.decided"),
                      value: proposal.decidedBy
                        ? t("assessment.decidedBy", {
                            name: proposal.decidedBy,
                            date: day(proposal.decidedAt),
                          })
                        : day(proposal.decidedAt),
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        {evaluation}

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

        <ProposalSentBy sentBy={proposal.sentBy} title={t("sentBy")} />

        {proposal.teamBackground && (
          <Card id="proposal-team" title={t("team.title")}>
            <p className="text-sm whitespace-pre-line">{proposal.teamBackground}</p>
          </Card>
        )}

        <Card id="proposal-file" title={t("file.title")}>
          {deck ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid min-w-0 text-sm">
                <span className="truncate font-medium">{deck.fileName}</span>
                <span className="text-muted-foreground">{size(deck.sizeBytes)}</span>
              </div>
              <div className="flex items-center gap-4">
                <PdfOpenButton
                  url={proposalFileAddress(proposal.id)}
                  name={deck.fileName}
                  meta={size(deck.sizeBytes)}
                  label={t("file.open")}
                  accessibleLabel={t("file.openFile", { name: deck.fileName })}
                />
                <TextButton href={proposalFileAddress(proposal.id)}>
                  <DownloadIcon aria-hidden="true" />
                  {t("file.download")}
                </TextButton>
              </div>
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
