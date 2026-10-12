"use client";

import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { useNotify } from "@/hooks/use-notify";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { joinOrganization, type OrganizationMatch } from "@/lib/api/generated";

import { OrganizationMark } from "./organization-mark";

/** What each outcome of joining is said as. */
const done = {
  joined: "Organization.done.joined",
  requested: "Organization.done.requested",
} as const;

/**
 * The way into an organization that exists, for whoever lists some: the one being asked about, the
 * one being sent, and the call itself. What happens depends on the organization: joining on its
 * verified domain, asking its owners, or claiming one that nobody owns yet, which GenAI Fund
 * reviews. Each is asked in one dialog first: joining shows the person to the members at once.
 *
 * @param onAnswered called once the person has joined or asked to, in place of reading the page
 *   again: for a caller that keeps what the backend answered itself. It says its own failure.
 */
function useOrganizationJoin(onAnswered?: () => Promise<void>) {
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<OrganizationMatch | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // The page shows what joining made of the caller once it has read it again; until then nothing is asked twice.
  const [refreshing, startRefresh] = useTransition();

  async function join(match: OrganizationMatch, note?: string) {
    setPending(match.id);
    try {
      const { data } = await joinOrganization({
        path: { id: match.id },
        body: { message: note?.trim() || null },
      });
      notify.success(done[data.outcome], { name: match.name });
      setAsking(null);
    } catch (error) {
      notify.failure(error);
      setPending(null);
      return;
    }
    if (onAnswered) {
      // The button stays busy until the caller has read what joining made of the person.
      void onAnswered().finally(() => setPending(null));
    } else {
      setPending(null);
      startRefresh(() => router.refresh());
    }
  }

  return {
    /** Opens the question for one organization. */
    ask: setAsking,
    /** The organization whose call is on its way. */
    pending,
    /** True while the page reads what joining made of the person. */
    refreshing,
    /** The question, to be drawn once by the caller. */
    dialog: asking && (
      <AskDialog
        match={asking}
        onJoin={(note) => join(asking, note)}
        onClose={() => setAsking(null)}
      />
    ),
  };
}

type OrganizationMatchRowProps = {
  match: OrganizationMatch;
  /** The size of its action: the finder's is the one thing to do, a notice's is not. */
  size?: "md" | "lg";
  prominence?: "primary" | "secondary";
  pending: boolean;
  disabled: boolean;
  onAsk: () => void;
};

/** One organization that exists, with what it is and the way into it for this person. */
function OrganizationMatchRow({
  match,
  size = "lg",
  prominence = "primary",
  pending,
  disabled,
  onAsk,
}: OrganizationMatchRowProps) {
  const t = useTranslations("Organization.find");
  const typeName = useVocabulary("organizationType");
  const countryName = useCountryName();

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <OrganizationMark name={match.name} logoFileId={match.logoFileId} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{match.name}</span>
          <span className="text-xs text-muted-foreground">
            {[typeName(match.type), match.country && countryName(match.country)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {match.way !== "request" && (
            <span className="text-xs text-muted-foreground">
              {match.way === "join" && match.emailDomain
                ? t("way.joinDomain", { domain: match.emailDomain })
                : t(`way.${match.way}`)}
            </span>
          )}
        </div>
      </div>
      <Button
        size={size}
        prominence={prominence}
        pending={pending}
        disabled={disabled}
        onClick={onAsk}
      >
        {t(`action.${match.way}`)}
      </Button>
    </div>
  );
}

type AskDialogProps = {
  /** The organization the person chose. */
  match: OrganizationMatch;
  /** Joins, asks or claims, with the message when there is one; it closes the dialog once done. */
  onJoin: (note?: string) => Promise<void>;
  onClose: () => void;
};

/**
 * Asks before joining, asking to join or claiming an organization. Joining by domain needs no
 * words; a request or a claim is read by someone, so it may carry some.
 */
function AskDialog({ match, onJoin, onClose }: AskDialogProps) {
  const t = useTranslations("Organization.find");
  const { way, name } = match;
  const form = useAppForm({
    defaultValues: { message: "" },
    onSubmit: ({ value }) => onJoin(way === "join" ? undefined : value.message),
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={t(`ask.${way}.title`, { name })}
      description={
        way === "claim" ? t("ask.claim.lead") : way === "join" ? t("ask.join.lead") : undefined
      }
      mark={{ tone: "info", icon: SendIcon }}
      width="md"
      submitLabel={t(`action.${way}`)}
      cancelLabel={t("ask.cancel")}
    >
      {way !== "join" && (
        <form.AppField name="message">
          {(field) => (
            <field.TextareaField
              label={t("ask.message")}
              rows={4}
              maxLength={500}
              description={
                way === "claim"
                  ? t("ask.claim.messageHint")
                  : t("ask.request.messageHint", { name })
              }
            />
          )}
        </form.AppField>
      )}
    </FormDialog>
  );
}

export { OrganizationMatchRow, useOrganizationJoin };
