import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Status } from "@/components/composites/status";
import { getFormatter } from "@/i18n/format-server";
import { ApiError } from "@/lib/api/client";
import { getUseCaseProposalForm } from "@/lib/api/generated";
import { getCurrentAccount, sessionRequest } from "@/lib/auth/session";
// The route helpers are named `useCase…`, which the hooks rule reads as hooks: they are called through the module.
import * as site from "@/lib/site";

import {
  accessOfForm,
  accessOfRefusal,
  closedAt,
  editStateOf,
  mayChange,
  outcomeOf,
  type Outcome,
  type SenderAccess,
} from "./proposal-access";

type ProposalActionsProps = {
  useCaseId: string;
  closesAt?: string | null;
  /** How many days after sending a proposal may still be edited; null when the brief does not say. */
  proposalEditDays?: number | null;
};

/** What the signed-in visitor may do about the use case; a failed read leaves the buttons in place. */
async function readAccess(useCaseId: string): Promise<SenderAccess> {
  try {
    const { data } = await getUseCaseProposalForm({
      ...(await sessionRequest()),
      path: { useCaseId },
    });
    return accessOfForm(data);
  } catch (error) {
    return error instanceof ApiError
      ? accessOfRefusal(error.status, error.code)
      : { kind: "open", draft: false };
  }
}

type SentProposalProps = {
  useCaseId: string;
  /** Until when it may be edited; null when it may not. */
  editable: boolean;
  /** What the organization that posted the use case told the sender, if it did. */
  outcome: Outcome | null;
  text: {
    status: string;
    state: string;
    note: string | null;
    sent: string;
    sentOn: string;
    until: string;
    untilValue: string;
    view: string;
    edit: string;
  };
};

/** The card of an organization whose proposal was sent: when, until when it may change, and the way to read or edit it. */
function SentProposal({ useCaseId, editable, outcome, text }: SentProposalProps) {
  return (
    <>
      <dl className="flex flex-col gap-1.5 text-sm">
        {outcome && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{text.status}</dt>
            <dd>
              <Status tone={outcome === "shortlisted" ? "success" : "neutral"}>{text.state}</Status>
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{text.sent}</dt>
          <dd>{text.sentOn}</dd>
        </div>
        {mayChange(outcome) && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{text.until}</dt>
            <dd>{text.untilValue}</dd>
          </div>
        )}
      </dl>
      {text.note && <p className="text-sm text-muted-foreground">{text.note}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" size="lg" href={site.proposalViewRoute(useCaseId)}>
          {text.view}
        </Button>
        {editable && (
          <Button prominence="secondary" size="lg" href={site.proposeToUseCaseRoute(useCaseId)}>
            {text.edit}
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * Send a proposal, in the card of a public use case. Nobody sees them for a use case
 * that takes no more proposals, and the posting organization sees a way to the proposals it received instead; an organization still waiting for GenAI Fund's review, or
 * none yet, sends all the same. Reading what the caller may do never stops the page from showing.
 */
async function ProposalActions({ useCaseId, closesAt, proposalEditDays }: ProposalActionsProps) {
  const closed = closedAt(closesAt);
  const [t, o, account, format] = await Promise.all([
    getTranslations("UseCases.detail.open"),
    getTranslations("UseCaseProposal.actions"),
    getCurrentAccount(),
    getFormatter(),
  ]);
  // A use case that no longer takes proposals still shows the proposal the organization sent.
  if (closed && !account) {
    return null;
  }
  const access: SenderAccess = account
    ? await readAccess(useCaseId)
    : { kind: "open", draft: false };
  // The organization that posted the use case reads what it received; it sends nothing to its own.
  if (access.kind === "own") {
    return (
      <Button className="w-full" size="lg" href={site.workspaceUseCaseProposalsRoute(useCaseId)}>
        {o("viewReceived")}
      </Button>
    );
  }
  if (access.kind === "hidden" || (closed && access.kind !== "sent")) {
    return null;
  }
  const day = (instant: string) => format.dateTime(new Date(instant), "date");
  const edit =
    access.kind === "sent" ? editStateOf(access.proposal, { closesAt, proposalEditDays }) : null;

  if (access.kind === "sent") {
    const outcome = outcomeOf(access.proposal);
    const state = outcome ? o(`outcome.${outcome}.state`) : "";
    const outcomeOn = access.proposal.outcomeSentAt ? day(access.proposal.outcomeSentAt) : "";
    return (
      <SentProposal
        useCaseId={useCaseId}
        editable={edit?.kind === "editable" && mayChange(outcome)}
        outcome={outcome}
        text={{
          status: o("status"),
          state,
          note: outcome && outcomeOn ? o(`outcome.${outcome}.note`, { date: outcomeOn }) : null,
          sent: o("sent"),
          sentOn: access.proposal.sentAt ? day(access.proposal.sentAt) : "",
          until: o("until"),
          untilValue: edit?.kind === "editable" ? day(edit.until) : o("closed"),
          view: o("view"),
          edit: o("edit"),
        }}
      />
    );
  }

  // A proposal that was taken back says so, and may be sent again while the use case takes proposals.
  if (access.kind === "open" && access.withdrawnAt) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          {o("withdrawn", { date: day(access.withdrawnAt) })}
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" href={site.proposeToUseCaseRoute(useCaseId)}>
            {o("sendAgain")}
          </Button>
          <Button prominence="secondary" size="lg" href={site.proposalViewRoute(useCaseId)}>
            {o("view")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Button className="w-full" size="lg" href={site.proposeToUseCaseRoute(useCaseId)}>
      {access.kind === "open" && access.draft ? o("continue") : t("send")}
    </Button>
  );
}

export { ProposalActions };
