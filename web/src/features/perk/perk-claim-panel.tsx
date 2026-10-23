"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { ArrowUpRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { CopyButton } from "@/components/actions/copy-button";
import { Status } from "@/components/composites/status";
import { useAppForm } from "@/components/form/app-form";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { failedWith } from "@/lib/api/failure";
import { claimPerk, type PerkClaim, type PerkPage } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/** The longest answer of one line, and of several, as the backend takes them. */
const answerLimits = { short: 200, long: 2000 } as const;

/** A link that leaves for the partner's site, told nothing of where it came from. */
const outside = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

/** What the team holds of the perk: the code to copy, the partner's page, or where its request stands. */
function ClaimView({ claim }: { claim: PerkClaim }) {
  const t = useTranslations("Perk.claim");
  const format = useFormatter();
  const tone =
    claim.state === "declined" ? "destructive" : claim.state === "waiting" ? "warning" : "success";

  return (
    <div className="flex flex-col gap-3">
      <Status tone={tone} appearance="pill">
        {t(`state.${claim.state}`)}
      </Status>
      {claim.code && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
          <code className="min-w-0 flex-1 font-mono text-sm font-semibold break-all">
            {claim.code}
          </code>
          <CopyButton appearance="icon" value={claim.code} label={t("copyCode")} />
        </div>
      )}
      {claim.redeemUrl && (
        <Button href={claim.redeemUrl} {...outside} prominence="secondary" className="w-full">
          {t("redeem")}
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      )}
      {claim.url && (
        <Button href={claim.url} {...outside} className="w-full">
          {t("open")}
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {t(`note.${claim.state}`, {
          name: claim.takenBy,
          date: format.dateTime(new Date(claim.takenAt), "date"),
        })}
      </p>
    </div>
  );
}

/** The questions of a request perk, answered and sent. */
function RequestForm({
  page,
  onClaimed,
}: {
  page: PerkPage;
  onClaimed: (claim: PerkClaim) => void;
}) {
  const t = useTranslations("Perk.claim");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const router = useRouter();
  const questions = page.questions.filter((question) => question.id);
  const schema = z.object({
    answers: z.object(
      Object.fromEntries(
        questions.map((question) => {
          const max = question.multiline ? answerLimits.long : answerLimits.short;
          const text = z.string().max(max, say("tooLong", { max }));
          return [
            question.id!,
            question.required ? text.refine((value) => value.trim() !== "", say("required")) : text,
          ];
        }),
      ),
    ),
  });

  const form = useAppForm({
    defaultValues: {
      answers: Object.fromEntries(questions.map((question) => [question.id!, ""])) as Record<
        string,
        string
      >,
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      try {
        const answers = Object.fromEntries(
          Object.entries(value.answers).filter(([, answer]) => answer.trim() !== ""),
        );
        const { data } = await claimPerk({ path: { slug: page.card.slug }, body: { answers } });
        notify.success(
          data.state === "waiting" ? "Perk.claim.done.sent" : "Perk.claim.done.granted",
        );
        onClaimed(data);
        router.refresh();
      } catch (error) {
        notify.failure(error);
        if (failedWith(error, "PERK_NO_PLACES_LEFT", "PERK_NOT_AVAILABLE")) {
          router.refresh();
        }
      }
    },
  });

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {questions.map((question) => (
        <form.AppField key={question.id} name={`answers.${question.id!}`}>
          {(field) =>
            question.multiline ? (
              <field.TextareaField
                label={question.label}
                requiredMark={question.required}
                maxLength={answerLimits.long}
              />
            ) : (
              <field.TextField
                label={question.label}
                requiredMark={question.required}
                maxLength={answerLimits.short}
              />
            )
          }
        </form.AppField>
      ))}
      <form.AppForm>
        <form.SubmitButton size="xl" className="w-full">
          {t("send")}
        </form.SubmitButton>
      </form.AppForm>
      <p className="text-xs text-muted-foreground">
        {t(page.requireApproval ? "approval" : "noApproval")}
      </p>
    </form>
  );
}

/** The one action that gets a perk that is no request: open its link, or take its code. */
function TakeButton({
  page,
  onClaimed,
}: {
  page: PerkPage;
  onClaimed: (claim: PerkClaim) => void;
}) {
  const t = useTranslations("Perk.claim");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function take() {
    setPending(true);
    try {
      const { data } = await claimPerk({ path: { slug: page.card.slug }, body: { answers: {} } });
      onClaimed(data);
      router.refresh();
    } catch (error) {
      notify.failure(error);
      if (failedWith(error, "PERK_NO_PLACES_LEFT", "PERK_NOT_AVAILABLE")) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="xl" className="w-full" pending={pending} onClick={take}>
      {t(`take.${page.card.way}`)}
    </Button>
  );
}

type PerkClaimPanelProps = {
  page: PerkPage;
  /** Where signing in leads, back to the perk. */
  signInHref: string;
};

/**
 * The panel that gets a perk, in the state the caller stands in: what the team holds, the way to get
 * it, or why it cannot be got now and what to do about it. A link for everyone opens straight away; any
 * other perk is got for the caller's team, which keeps what it got.
 */
function PerkClaimPanel({ page, signInHref }: PerkClaimPanelProps) {
  const t = useTranslations("Perk.claim");
  const [claim, setClaim] = useState<PerkClaim | null>(page.claim ?? null);
  const { card } = page;

  let body: React.ReactNode;
  if (claim) {
    body = <ClaimView claim={claim} />;
  } else if (card.standing === "eligible" && page.url) {
    body = (
      <Button href={page.url} {...outside} size="xl" className="w-full">
        {t("open")}
        <ArrowUpRightIcon aria-hidden="true" />
      </Button>
    );
  } else if (card.standing === "eligible") {
    body =
      card.way === "request" ? (
        <RequestForm page={page} onClaimed={setClaim} />
      ) : (
        <TakeButton page={page} onClaimed={setClaim} />
      );
  } else if (card.standing === "sign_in") {
    body = (
      <Button href={signInHref} size="xl" className="w-full">
        {t("signIn")}
      </Button>
    );
  } else if (card.standing === "organization") {
    body = (
      <Button
        href={siteRoutes.workspaceOrganization}
        prominence="secondary"
        size="xl"
        className="w-full"
      >
        {t("organizationAction")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-medium">{t(claim ? "heldTitle" : "title")}</h2>
        {!claim && card.standing !== "eligible" && (
          <p className="text-sm text-muted-foreground">
            {t(`why.${card.standing}`, { program: card.programName ?? "" })}
          </p>
        )}
      </div>
      {body}
    </div>
  );
}

export { PerkClaimPanel };
