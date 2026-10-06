import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicUseCaseSummary } from "@/lib/api/generated";

/**
 * One use case of the list. From 768px: a frame for the organization's logo, the brief in short, and a
 * side column with the budget, the timeline and the deadline. On a phone only what decides whether the
 * use case is worth reading stays: title, organization, tags, budget, timeline and deadline. The logo
 * frame stays empty until organizations have a logo to show; the page of one use case is not built yet,
 * so the card does not link to it.
 */
function UseCaseCard({ useCase }: { useCase: PublicUseCaseSummary }) {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const technologyName = useVocabulary("technology");
  const format = useFormatter();
  const deadline = new Date(useCase.closesAt);
  const technologies = useCase.technologies.map((technology) => technologyName(technology));
  const budget = useCase.budgetToBeDetermined
    ? t("budget.toBeDetermined")
    : useCase.budgetMin == null || useCase.budgetMax == null
      ? t("budget.membersOnly")
      : t("budget.range", { min: useCase.budgetMin, max: useCase.budgetMax });

  return (
    <li className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4 text-card-foreground md:flex-nowrap md:gap-4 md:p-5 xl:gap-5">
      <div
        aria-hidden="true"
        className="size-12 shrink-0 rounded-lg border bg-card md:size-24 md:rounded-xl xl:size-34"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="line-clamp-3 text-lg font-semibold tracking-title md:line-clamp-2 xl:text-xl">
          {useCase.title}
        </h2>
        <p className="text-xs text-muted-foreground uppercase md:text-sm">
          {useCase.organizationName ?? t("anonymous")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{industryName(useCase.industry)}</Badge>
        </div>

        <p className="line-clamp-2 hidden pt-1 text-sm md:block">
          {t("goal", { goal: useCase.goal })}
        </p>

        <div className="mt-auto hidden items-start justify-between gap-4 border-t pt-3 md:flex">
          <ul
            aria-label={t("technology.label")}
            className="flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground"
          >
            <li className="truncate">{technologies[0]}</li>
            {technologies.length > 1 && (
              <li className="hidden truncate border-l pl-2.5 xl:block">{technologies[1]}</li>
            )}
            {technologies.length > 1 && (
              <li className="border-l pl-2.5 font-medium text-foreground xl:hidden">
                {t("technology.more", { count: technologies.length - 1 })}
              </li>
            )}
            {technologies.length > 2 && (
              <li className="hidden border-l pl-2.5 font-medium text-foreground xl:block">
                {t("technology.more", { count: technologies.length - 2 })}
              </li>
            )}
          </ul>
          <p className="shrink-0 text-xs text-muted-foreground">
            {t("posted", { when: format.relativeTime(new Date(useCase.publishedAt)) })}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 border-t pt-3 md:w-52 md:shrink-0 md:gap-5 md:border-t-0 md:border-l md:pt-0 md:pl-5 xl:w-62 xl:pl-6">
        <dl className="flex justify-between gap-4 md:flex-col md:justify-start md:gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("budget.label")}</dt>
            <dd className="font-semibold xl:text-lg">{budget}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("timeline.label")}</dt>
            <dd>
              {t("timeline.range", {
                min: useCase.timelineMinWeeks,
                max: useCase.timelineMaxWeeks,
              })}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {t("deadline.date", {
            date: format.dateTime(deadline, { day: "numeric", month: "short", year: "numeric" }),
          })}
          <br />
          {t("deadline.time", {
            time: format.dateTime(deadline, {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
              timeZone: "Asia/Ho_Chi_Minh",
            }),
          })}
        </p>
      </div>
    </li>
  );
}

export { UseCaseCard };
