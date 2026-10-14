import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useFileSize } from "@/features/solution/solution-deck";
import { useFormatter } from "@/i18n/format";
import type { UseCaseProposal, UseCaseProposalForm } from "@/lib/api/generated";
import { proposeToUseCaseRoute as proposeRoute, siteRoutes, useCaseRoute } from "@/lib/site";

import { Card, Rows } from "./proposal-card";
import { ProposalSentBy } from "./proposal-sender-card";
import { ProposalSolutionList } from "./proposal-solution-list";
import { WithdrawProposal } from "./proposal-withdraw";
import { mayChange, outcomeOf, type EditState } from "./proposal-access";

type ProposalViewPageProps = {
  form: UseCaseProposalForm;
  proposal: UseCaseProposal;
  edit: EditState;
};

/**
 * What the caller's organization sent to a use case, read-only: the organization, the solutions
 * and the approach, the sender's profile as it was sent, the team and the PDF, when it was sent and
 * edited, the way into editing while the window is open, and the way to take it back while the use case
 * takes proposals. A proposal that was taken back reads the same, says so, and may be sent again.
 */
function ProposalViewPage({ form, proposal, edit }: ProposalViewPageProps) {
  const t = useTranslations("UseCaseProposal.view");
  const detail = useTranslations("UseCaseProposal.received.detail");
  const closed = useTranslations("UseCaseProposal.actions.editClosed");
  const taken = useTranslations("UseCaseProposal.view.notice");
  const size = useFileSize();
  const format = useFormatter();
  const day = (instant: string) => format.dateTime(new Date(instant), "date");
  const { deck } = proposal;
  const withdrawn = proposal.status === "draft" ? proposal.withdrawnAt : null;
  // The use case still takes proposals unless its closing time has passed.
  const useCaseClosed = edit.kind === "closed" && edit.reason === "useCaseClosed";
  const outcome = outcomeOf(proposal);
  const changeable = mayChange(outcome);
  const closesOn = form.useCase.closesAt ? day(form.useCase.closesAt) : undefined;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-220 flex-col gap-5">
        <header className="flex flex-col gap-2">
          <nav
            aria-label={detail("crumbs")}
            className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-medium"
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
                {withdrawn && t("withdrawn", { date: day(withdrawn) })}
                {proposal.sentAt && t("sent", { date: day(proposal.sentAt) })}
                {proposal.editedAt && ` · ${t("edited", { date: day(proposal.editedAt) })}`}
                {edit.kind === "editable" &&
                  changeable &&
                  ` · ${t("until", { when: day(edit.until) })}`}
              </span>
              {proposal.status === "sent" && !useCaseClosed && changeable && proposal.sentAt && (
                <WithdrawProposal
                  proposalId={proposal.id}
                  useCaseTitle={form.useCase.title}
                  sentOn={day(proposal.sentAt)}
                  closesOn={closesOn}
                />
              )}
              {edit.kind === "editable" && changeable && (
                <Button href={proposeRoute(form.useCase.id)}>{t("edit")}</Button>
              )}
              {withdrawn && !useCaseClosed && (
                <Button href={proposeRoute(form.useCase.id)}>{t("sendAgain")}</Button>
              )}
            </div>
          </div>
          {edit.kind !== "editable" && !useCaseClosed && !withdrawn && changeable && (
            <p className="text-sm text-muted-foreground">{closed(edit.reason)}</p>
          )}
        </header>

        {outcome && proposal.outcomeSentAt && (
          <Card id="proposal-outcome" title={taken(`outcome.${outcome}.title`)}>
            <p className="text-sm text-muted-foreground">
              {taken(`outcome.${outcome}.text`, { date: day(proposal.outcomeSentAt) })}
            </p>
          </Card>
        )}
        {withdrawn && (
          <Card id="proposal-notice" title={taken("withdrawn.title")}>
            <p className="text-sm text-muted-foreground">
              {useCaseClosed
                ? taken("withdrawn.closed")
                : closesOn
                  ? taken("withdrawn.until", { date: closesOn })
                  : taken("withdrawn.open")}
            </p>
          </Card>
        )}
        {useCaseClosed && !withdrawn && (
          <Card id="proposal-notice" title={taken("closed.title")}>
            <p className="text-sm text-muted-foreground">{taken("closed.text")}</p>
          </Card>
        )}

        <Card id="proposal-solutions" title={detail("solutions.title")}>
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

        {proposal.sentBy && <ProposalSentBy sentBy={proposal.sentBy} title={detail("sentBy")} />}

        {proposal.teamBackground && (
          <Card id="proposal-team" title={detail("team.title")}>
            <p className="text-sm whitespace-pre-line">{proposal.teamBackground}</p>
          </Card>
        )}

        <Card id="proposal-file" title={detail("file.title")}>
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
