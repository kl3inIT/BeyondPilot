"use client";

import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useAppForm } from "@/components/form/app-form";
import { useFormatter } from "@/i18n/format";
import type { MatchingCandidate } from "@/lib/api/generated";

/** The longest note a person may write to the provider, as the backend keeps it. */
const MAX_NOTE = 500;

type MatchingInviteProps = {
  /** The candidate whose provider is invited; nothing is shown while it is null. */
  candidate: MatchingCandidate | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sends the invitation; resolves to whether it was kept, and the dialog closes only then. */
  onInvite: (note: string | undefined) => Promise<boolean>;
};

/**
 * Asks once before the provider of a matched solution is invited to propose, since the email cannot be
 * taken back: who is emailed, about what, and a note to the provider if the person wants one. A refusal
 * keeps the dialog open with what was written; the board says why.
 */
function MatchingInvite({ candidate, pending, onOpenChange, onInvite }: MatchingInviteProps) {
  const t = useTranslations("Matching.invite");
  const form = useAppForm({
    defaultValues: { note: "" },
    onSubmit: async ({ value }) => {
      if (await onInvite(value.note.trim() || undefined)) {
        form.reset();
      }
    },
  });
  const provider = candidate?.organizationName ?? candidate?.solutionName ?? "";

  return (
    <ConfirmDialog
      open={candidate !== null}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
        }
        onOpenChange(open);
      }}
      title={t("title", { name: provider })}
      description={t("description", { name: provider })}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      pending={pending}
      onConfirm={() => void form.handleSubmit()}
    >
      <form.AppField name="note">
        {(field) => <field.TextareaField label={t("note")} rows={3} maxLength={MAX_NOTE} />}
      </form.AppField>
    </ConfirmDialog>
  );
}

/**
 * That the provider was invited, as a short line: when, and, in its title, by whom. A member reads that
 * GenAI Fund invited it, never which operator.
 */
function InvitedMark({
  candidate,
}: {
  candidate: Pick<MatchingCandidate, "invitedAt" | "invitedBy" | "invitedByOperator">;
}) {
  const t = useTranslations("Matching.invite");
  const format = useFormatter();
  if (!candidate.invitedAt) {
    return null;
  }
  const date = format.dateTime(new Date(candidate.invitedAt), { day: "numeric", month: "short" });
  const by = candidate.invitedBy ?? (candidate.invitedByOperator ? t("genaiFund") : undefined);

  return (
    <span
      data-slot="matching-invited"
      title={by ? t("invitedBy", { name: by, date }) : undefined}
      className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <MailCheckIcon aria-hidden="true" className="size-4 shrink-0" />
      {t("invited", { date })}
    </span>
  );
}

export { InvitedMark, MatchingInvite };
