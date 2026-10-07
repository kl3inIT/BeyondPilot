import { ArrowLeftIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ApplicationView } from "@/lib/api/generated";
import { programApplyUrl, siteRoutes } from "@/lib/site";

import { applyFormatter } from "./apply-format";
import { ApplicationSummary } from "./application-summary";
import { WithdrawApplication } from "./withdraw-application";

/**
 * One application as its applicant follows it: what it holds, where it stands, and what they can
 * still do with it before the close.
 */
async function ApplicationPage({ view }: { view: ApplicationView }) {
  const [t, locale] = await Promise.all([getTranslations("Application"), getLocale()]);
  const format = applyFormatter(locale);
  const application = view.application!;
  const program = view.program;
  const solution = view.solutions.find((option) => option.id === application.solutionId);
  // Where the program takes no changes after submission, a withdrawn application stays withdrawn too.
  const changeable =
    program.open && (application.status === "draft" || program.allowUpdatesUntilClose);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
      <Link
        href={siteRoutes.myApplications}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-title">
            {solution?.name ?? program.name}
          </h1>
          {application.outcome ? (
            <Badge variant={application.outcome === "shortlisted" ? "success" : "outline"}>
              {t(`result.${application.outcome}`)}
            </Badge>
          ) : (
            <Badge variant={application.status === "submitted" ? "info" : "outline"}>
              {t(`status.${application.status}`)}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {[program.name, view.organization?.name].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ApplicationSummary view={view} />
        </div>
        <aside
          aria-label={t("whereItStands")}
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-6 lg:w-80"
        >
          <h2 className="font-medium">{t("whereItStands")}</h2>
          {application.outcome && (
            <p className="rounded-lg border bg-muted p-3 text-sm">
              {t(`resultLead.${application.outcome}`)}
            </p>
          )}
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("submitted")}</dt>
              <dd className="text-right">
                {application.submittedAt ? format.moment(application.submittedAt) : t("notYet")}
              </dd>
            </div>
            {application.submissions > 1 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("versions")}</dt>
                <dd>{application.submissions}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("closes")}</dt>
              <dd className="text-right">{format.deadline(program.closesAt)}</dd>
            </div>
            {program.outcomesDueOn && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("outcome")}</dt>
                <dd className="text-right">{format.day(program.outcomesDueOn)}</dd>
              </div>
            )}
          </dl>
          {changeable ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              <Button prominence="secondary" href={programApplyUrl(program.slug)}>
                {application.status === "draft" ? t("continue") : t("edit")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("editHint", { when: format.deadline(program.closesAt) })}
              </p>
              {application.status === "submitted" && (
                <WithdrawApplication
                  id={application.id}
                  program={program.name}
                  final={!program.allowUpdatesUntilClose}
                />
              )}
            </div>
          ) : (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              {program.open ? t("locked") : t("closed")}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export { ApplicationPage };
