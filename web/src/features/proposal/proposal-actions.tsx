import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
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
  /** Whether it may be edited, and the line that says so or why not. */
  editable: boolean;
  text: { sent: string; view: string; edit: string; note: string };
};

/** The card of an organization whose proposal was sent: when, and the way to read or edit it. */
function SentProposal({ useCaseId, editable, text }: SentProposalProps) {
  return (
    <>
      <p className="text-sm font-medium">{text.sent}</p>
      <Button className="w-full" size="lg" href={site.proposalViewRoute(useCaseId)}>
        {text.view}
      </Button>
      {editable && (
        <Button
          className="w-full"
          prominence="secondary"
          size="lg"
          href={site.proposeToUseCaseRoute(useCaseId)}
        >
          {text.edit}
        </Button>
      )}
      <p className="text-sm text-muted-foreground">{text.note}</p>
    </>
  );
}

/**
 * Send a proposal, in the card of a public use case. Nobody sees them for their
 * own organization's use case or one that takes no more proposals; an organization GenAI Fund has not approved sees the
 * button disabled with the reason. Reading what the caller may do never stops the page from showing.
 */
async function ProposalActions({ useCaseId, closesAt, proposalEditDays }: ProposalActionsProps) {
  const closed = closedAt(closesAt);
  const [t, e, o, account, format, c] = await Promise.all([
    getTranslations("UseCases.detail.open"),
    getTranslations("UseCaseProposal.errors"),
    getTranslations("UseCaseProposal.actions"),
    getCurrentAccount(),
    getFormatter(),
    getTranslations("UseCaseProposal.actions.editClosed"),
  ]);
  // A use case that no longer takes proposals still shows the proposal the organization sent.
  if (closed && !account) {
    return null;
  }
  const access: SenderAccess = account
    ? await readAccess(useCaseId)
    : { kind: "open", draft: false };
  if (access.kind === "hidden" || (closed && access.kind !== "sent")) {
    return null;
  }
  const when = (instant: string) =>
    format.dateTime(new Date(instant), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const edit =
    access.kind === "sent" ? editStateOf(access.proposal, { closesAt, proposalEditDays }) : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {access.kind === "sent" ? (
          <SentProposal
            useCaseId={useCaseId}
            editable={edit?.kind === "editable"}
            text={{
              sent: access.proposal.sentAt
                ? o("sentOn", { date: when(access.proposal.sentAt) })
                : o("sent"),
              view: o("view"),
              edit: o("edit"),
              note:
                edit?.kind === "editable"
                  ? o("editUntil", { when: when(edit.until) })
                  : c(edit?.reason ?? "windowPassed"),
            }}
          />
        ) : (
          <>
            {access.kind === "blocked" ? (
              <Button className="w-full" size="lg" disabled>
                {t("send")}
              </Button>
            ) : (
              <Button className="w-full" size="lg" href={site.proposeToUseCaseRoute(useCaseId)}>
                {access.kind === "open" && access.draft ? o("continue") : t("send")}
              </Button>
            )}
            {access.kind === "blocked" && (
              <p className="text-sm text-muted-foreground">{e(access.code)}</p>
            )}
          </>
        )}
      </div>
      {access.kind !== "sent" && access.kind !== "blocked" && (proposalEditDays ?? 0) > 0 && (
        <p className="text-xs leading-5 text-muted-foreground">
          {t("note", { days: proposalEditDays ?? 0 })}
        </p>
      )}
    </>
  );
}

export { ProposalActions };
