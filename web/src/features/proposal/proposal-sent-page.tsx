import { CircleCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { useFormatter } from "@/i18n/format";
import type { UseCaseProposal, UseCaseProposalForm } from "@/lib/api/generated";
import { siteRoutes, useCaseRoute } from "@/lib/site";

type ProposalSentPageProps = {
  form: UseCaseProposalForm;
  proposal: UseCaseProposal;
};

/** What the sender sees once the proposal is sent: what was sent and what happens next. */
function ProposalSentPage({ form, proposal }: ProposalSentPageProps) {
  const t = useTranslations("UseCaseProposal.wizard.sent");
  const format = useFormatter();
  const sent = proposal.sentAt
    ? `${format.dateTime(new Date(proposal.sentAt), "date")}, ${format.dateTime(new Date(proposal.sentAt), "time")} ICT`
    : "";

  const rows = [
    { key: "useCase", value: form.useCase.title },
    { key: "organization", value: form.organization?.name ?? "" },
    { key: "sent", value: sent },
  ] as const;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 py-10 md:py-16">
      <div className="flex h-fit w-full max-w-2xl flex-col gap-8 rounded-3xl border bg-background p-6 md:p-10">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <CircleCheckIcon className="size-8 text-success" aria-hidden="true" />
          {t("title")}
        </h1>

        <dl className="flex flex-col divide-y border-y text-sm">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-muted-foreground">{t(`rows.${row.key}`)}</dt>
              <dd className="sm:col-span-2">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button href={useCaseRoute(form.useCase.id)}>{t("backToUseCase")}</Button>
          <Button prominence="secondary" href={siteRoutes.useCases}>
            {t("moreUseCases")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ProposalSentPage };
