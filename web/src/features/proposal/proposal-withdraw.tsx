"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { withdrawUseCaseProposal } from "@/lib/api/generated";

import { Rows } from "./proposal-card";
import { proposalWords } from "./proposal-errors";

type WithdrawProposalProps = {
  proposalId: string;
  useCaseTitle: string;
  /** When it was sent, as the page writes dates. */
  sentOn: string;
  /** The day the use case closes, as the page writes dates; absent when it has no closing time. */
  closesOn?: string;
};

/**
 * Takes a sent proposal back, after asking. The proposal goes back to a draft that keeps what it held, the
 * organization that posted the use case no longer reads it, and its owner may send it again until the use case closes.
 */
function WithdrawProposal({ proposalId, useCaseTitle, sentOn, closesOn }: WithdrawProposalProps) {
  const t = useTranslations("UseCaseProposal.view.withdraw");
  const router = useRouter();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function withdraw() {
    setPending(true);
    try {
      await withdrawUseCaseProposal({ path: { id: proposalId } });
      notify.success("UseCaseProposal.view.withdraw.done");
      setOpen(false);
      router.refresh();
    } catch (error) {
      notify.failure(error, proposalWords);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button prominence="secondary" tone="danger" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
        note={closesOn ? t("noteUntil", { date: closesOn }) : t("noteOpen")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={withdraw}
      >
        <div className="rounded-lg bg-muted p-3">
          <Rows
            rows={[
              { label: t("rows.useCase"), value: useCaseTitle },
              { label: t("rows.sent"), value: sentOn },
            ]}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

export { WithdrawProposal };
