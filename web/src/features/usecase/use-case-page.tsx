import { useLocale, useTranslations } from "next-intl";

import { Status } from "@/components/composites/status";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ProposalActions } from "@/features/proposal/proposal-actions";
import { closedAt } from "@/features/proposal/proposal-access";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicUseCase } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { momentText } from "@/i18n/formats";

import { budgetFigures, budgetText } from "./use-case-budget";
import { timelineText } from "./use-case-timeline";

type DetailSectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

/** One written part of a public use-case brief. */
function DetailSection({ id, title, children }: DetailSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 border-t pt-6 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="text-xl font-semibold tracking-title">
        {title}
      </h2>
      <div className="text-sm leading-6 wrap-anywhere whitespace-pre-line text-muted-foreground md:text-base">
        {children}
      </div>
    </section>
  );
}

type FactProps = {
  label: string;
  value: string;
};

/** A compact, scannable part of a public use-case brief. */
function Fact({ label, value }: FactProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-muted/50 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

/**
 * The public brief of one published use case and the actions to send a proposal. How many proposals
 * it received is not shown to visitors. Read from a read-only link (`preview`), it says so and offers
 * no proposal, since the use case is not public.
 */
function UseCasePage({ useCase, preview = false }: { useCase: PublicUseCase; preview?: boolean }) {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const technologyName = useVocabulary("technology");
  const format = useFormatter();
  const locale = useLocale();
  const closed = closedAt(useCase.closesAt);
  const organizationName = useCase.organizationName ?? t("anonymous");
  const budget = useCase.budgetToBeDetermined
    ? t("budget.toBeDetermined")
    : useCase.budgetMin == null || useCase.budgetMax == null
      ? t("budget.membersOnly")
      : budgetText(
          budgetFigures(useCase.budgetMin, useCase.budgetMax, useCase.currency, locale),
          (key, values) => t(`budget.${key}`, values),
        );
  const timeline =
    useCase.timelineMinWeeks != null && useCase.timelineMaxWeeks != null
      ? timelineText(useCase.timelineMinWeeks, useCase.timelineMaxWeeks, (key, values) =>
          t(`timeline.${key}`, values),
        )
      : t("detail.notSpecified");
  const deadline = useCase.closesAt
    ? momentText(format, new Date(useCase.closesAt))
    : t("deadline.none");
  const proposalDeadline = useCase.closesAt
    ? t(closed ? "detail.closed.on" : "detail.open.closes", {
        when: format.dateTime(new Date(useCase.closesAt), "day"),
      })
    : t("detail.open.noDeadline");
  const sections = [
    ["problem", "problemStatement" as const],
    ["outcomes", "expectedOutcomes" as const],
    ["currentProcess", "currentProcess" as const],
    ["currentSolutions", "currentSolutions" as const],
    ["targetUsers", "targetUsers" as const],
    ["dataReadiness", "dataReadiness" as const],
    ["integration", "integrationRequirements" as const],
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-4 pb-24 md:gap-7 md:px-8 md:pt-6 xl:px-16 desktop:px-20">
      {preview && (
        <p
          role="status"
          className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
        >
          {t("preview.banner")}
        </p>
      )}

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={siteRoutes.useCases} />}>
              {t("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{useCase.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-start gap-3.5 md:gap-5">
          <OrganizationMark name={organizationName} logoFileId={useCase.organizationLogoFileId} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl xl:text-5xl xl:leading-none">
              {useCase.title}
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">
              {t("detail.by", {
                organization: organizationName,
                when: format.relativeTime(new Date(useCase.publishedAt)),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{industryName(useCase.industry)}</Badge>
          {useCase.technologies.map((technology) => (
            <Badge key={technology} variant="outline">
              {technologyName(technology)}
            </Badge>
          ))}
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact label={t("budget.label")} value={budget} />
        <Fact label={t("timeline.label")} value={timeline} />
        <Fact label={t(closed ? "detail.closed.label" : "detail.applyBy")} value={deadline} />
      </dl>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-7 md:gap-9">
          {sections.map(([id, field]) => {
            const value = useCase[field];
            return value ? (
              <DetailSection key={id} id={`use-case-${id}`} title={t(`detail.sections.${id}`)}>
                {value}
              </DetailSection>
            ) : null;
          })}
          {useCase.technologies.length > 0 && (
            <DetailSection id="use-case-technologies" title={t("technology.label")}>
              <span className="flex flex-wrap gap-2">
                {useCase.technologies.map((technology) => (
                  <Badge key={technology} variant="secondary">
                    {technologyName(technology)}
                  </Badge>
                ))}
              </span>
            </DetailSection>
          )}
        </div>

        <aside className="flex flex-col gap-4.5 rounded-2xl border bg-card p-6 shadow-sm lg:sticky lg:top-23 lg:w-75 lg:shrink-0 xl:w-95">
          <div className="flex items-center justify-between gap-2">
            <Status tone={closed ? "neutral" : "success"} appearance="pill">
              {t(closed ? "proposalStatus.closed" : "detail.open.status")}
            </Status>
            <span className="text-sm text-muted-foreground">{proposalDeadline}</span>
          </div>
          {preview ? (
            <p className="text-sm text-muted-foreground">{t("preview.noProposals")}</p>
          ) : (
            <ProposalActions
              useCaseId={useCase.id}
              closesAt={useCase.closesAt}
              proposalEditDays={useCase.proposalEditDays}
              challenge={useCase.challenge ?? null}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

export { UseCasePage };
