import { CircleCheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import type { ApplicationView } from "@/lib/api/generated";
import { myApplicationRoute, siteRoutes } from "@/lib/site";

import { applyFormatter } from "./apply-format";

/** What a person reads once they have submitted: a receipt, what happens next, and where to go. */
async function ApplicationReceipt({ view }: { view: ApplicationView }) {
  const [t, locale] = await Promise.all([getTranslations("Application.receipt"), getLocale()]);
  const format = applyFormatter(locale);
  const application = view.application!;
  const program = view.program;
  const solution = view.solutions.find((option) => option.id === application.solutionId);
  const rows: [string, string][] = [
    [t("program"), program.name],
    ...(solution ? [[t("solution"), solution.name] as [string, string]] : []),
    ...(view.organization ? [[t("organization"), view.organization.name] as [string, string]] : []),
    [t("submitted"), application.submittedAt ? format.moment(application.submittedAt) : ""],
    ...(program.allowUpdatesUntilClose
      ? [[t("editUntil"), format.moment(program.closesAt)] as [string, string]]
      : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-10 md:py-16">
      <div className="flex flex-col gap-6 rounded-3xl border bg-card p-6 md:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-title">
            <CircleCheckIcon className="size-6 shrink-0 text-success" aria-hidden="true" />
            {application.submissions > 1 ? t("titleAgain") : t("title")}
          </h1>
          <p className="text-muted-foreground">{t("emailed", { email: view.email })}</p>
        </div>
        <dl className="flex flex-col border-t">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("next")}</h2>
          <p className="text-sm text-muted-foreground">
            {program.outcomesDueOn
              ? t("nextOutcome", { day: format.day(program.outcomesDueOn) })
              : t("nextReview")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button href={myApplicationRoute(application.id)}>{t("view")}</Button>
          <Button prominence="secondary" href={siteRoutes.programs}>
            {t("programs")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ApplicationReceipt };
