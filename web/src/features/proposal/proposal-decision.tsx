"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useAppForm } from "@/components/form/app-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { Link, useRouter } from "@/i18n/navigation";
import { decideUseCaseProposal, sendUseCaseProposalOutcomes } from "@/lib/api/generated";

import { proposalWords } from "./proposal-errors";
import type { ProposalDecision } from "./received-proposals";

/** The longest note the backend takes for the e-mails. */
const MAX_MESSAGE = 2000;

type Deciding = {
  proposalId: string;
  /** The organization that sent it, named in the toast. */
  name: string;
  decision: ProposalDecision | null | undefined;
};

/**
 * Marks a received proposal Shortlisted or Declined. It only saves: nobody is e-mailed until the
 * outcomes are sent, so there is nothing to ask first, and it can be changed any time.
 */
function useDecide({ proposalId, name }: Deciding) {
  const router = useRouter();
  const notify = useNotify();
  const [pending, setPending] = useState(false);

  async function decide(decision: ProposalDecision) {
    setPending(true);
    try {
      await decideUseCaseProposal({ path: { id: proposalId }, body: { decision } });
      notify.success(`UseCaseProposal.received.decided.${decision}`, { name });
      router.refresh();
    } catch (error) {
      notify.failure(error, proposalWords);
    } finally {
      setPending(false);
    }
  }

  return { pending, decide };
}

/** Decline and Shortlist, in the header of a received proposal; the one that is the decision now is not offered again. */
function DecideButtons(props: Deciding) {
  const t = useTranslations("UseCaseProposal.received.detail");
  const { pending, decide } = useDecide(props);
  return (
    <>
      <Button
        prominence="secondary"
        disabled={pending || props.decision === "declined"}
        onClick={() => void decide("declined")}
      >
        {t("decline")}
      </Button>
      <Button
        disabled={pending || props.decision === "shortlisted"}
        onClick={() => void decide("shortlisted")}
      >
        {t("shortlist")}
      </Button>
    </>
  );
}

/** The "…" menu of a row of the received list: open the proposal, shortlist it or decline it. */
function ProposalRowMenu({ href, ...props }: Deciding & { href: string }) {
  const t = useTranslations("UseCaseProposal.received");
  const { pending, decide } = useDecide(props);
  return (
    <DropdownMenu>
      <RowMenuTrigger aria-label={t("actions.open", { name: props.name })} disabled={pending} />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={href} />}>{t("actions.view")}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={props.decision === "shortlisted"}
            onClick={() => void decide("shortlisted")}
          >
            {t("actions.shortlist")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={props.decision === "declined"}
            onClick={() => void decide("declined")}
          >
            {t("actions.decline")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SendOutcomesProps = {
  useCaseId: string;
  /** The decisions the senders were not told yet, in all and by kind. */
  pending: { shortlisted: number; declined: number; total: number };
};

/**
 * Tells the senders what was decided, after asking: one e-mail for each proposal whose decision they
 * do not know yet, with an optional note that every e-mail quotes. Nobody outside the team sees a
 * decision until this runs.
 */
function SendOutcomes({ useCaseId, pending: waiting }: SendOutcomesProps) {
  const t = useTranslations("UseCaseProposal.received.send");
  const router = useRouter();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const form = useAppForm({
    defaultValues: { message: "" },
    onSubmit: async ({ value }) => {
      setPending(true);
      try {
        const { data } = await sendUseCaseProposalOutcomes({
          path: { useCaseId },
          body: { message: value.message.trim() || null },
        });
        notify.success("UseCaseProposal.received.send.done", { count: data.sent });
        setOpen(false);
        form.reset();
        router.refresh();
      } catch (error) {
        notify.failure(error, proposalWords);
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <>
      <Button disabled={waiting.total === 0} onClick={() => setOpen(true)}>
        <SendIcon aria-hidden="true" />
        {t("action", { count: waiting.total })}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description", {
          shortlisted: waiting.shortlisted,
          declined: waiting.declined,
        })}
        note={t("note")}
        confirmLabel={t("confirm", { count: waiting.total })}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() => void form.handleSubmit()}
      >
        <form.AppField name="message">
          {(field) => <field.TextareaField label={t("message")} rows={4} maxLength={MAX_MESSAGE} />}
        </form.AppField>
      </ConfirmDialog>
    </>
  );
}

export { DecideButtons, ProposalRowMenu, SendOutcomes };
