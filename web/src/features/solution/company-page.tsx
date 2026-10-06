import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSerializer } from "nuqs/server";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type {
  PublicCustomerDeploymentList,
  PublicOrganization,
  PublicSolutionSummary,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentCard } from "./customer-deployment-card";
import { SolutionLogo } from "./solution-logo";
import { type CompanySolutions, MAX_COMPANY_PAGES } from "./solution-queries";
import { companySearch } from "./solutions-search";

const address = createSerializer(companySearch);

/** How many capabilities a solution names here before it counts the rest. */
const CAPABILITY_LIMIT = 3;

/**
 * One solution in the list of its organization: its logo slot, its name, which leads to its page,
 * and the first industry it is filed under. The whole card is that link, so the words at its foot
 * only point to it.
 */
function CompanySolution({ solution }: { solution: PublicSolutionSummary }) {
  const t = useTranslations("Solution.detail.company");
  const directory = useTranslations("Solution.directory");
  const focusArea = useVocabulary("focusArea");
  const industry = useVocabulary("industry");
  const rest = solution.focusAreas.length - CAPABILITY_LIMIT;

  return (
    <article className="group relative flex flex-col gap-2.5 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="flex items-center gap-3">
        <SolutionLogo name={solution.name} fileId={solution.logoFileId} size="card" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-lg font-semibold">
            <Link
              href={`${siteRoutes.solutions}/${solution.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {solution.name}
            </Link>
          </h3>
          {solution.industries.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              {industry(solution.industries[0])}
            </p>
          )}
        </div>
      </div>
      {solution.summary && <p className="text-sm text-muted-foreground">{solution.summary}</p>}
      {solution.focusAreas.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1">
          {solution.focusAreas.slice(0, CAPABILITY_LIMIT).map((code) => (
            <li key={code}>
              <Badge variant="outline">{focusArea(code)}</Badge>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <Badge variant="secondary">{directory("more", { count: rest })}</Badge>
            </li>
          )}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-xs text-muted-foreground">
          {solution.customerDeployments > 0
            ? t("listedBelow", { count: solution.customerDeployments })
            : directory("noCase")}
        </p>
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 group-hover:underline"
        >
          {t("explore")}
          <ArrowRightIcon className="size-3.5" />
        </span>
      </div>
    </article>
  );
}

type CompanyPageProps = {
  organization: PublicOrganization;
  /** The solutions it shows so far, and how many it lists. */
  solutions: CompanySolutions;
  /** How many more pages have been loaded; none shows the preview. */
  more: number;
  /** The first page of the approved customer deployments of its solutions. */
  deployments: PublicCustomerDeploymentList;
};

/**
 * The public page of an organization, where "By …" on a solution leads: who it is, the solutions it
 * lists and the customer deployments behind them, with its facts beside. Its team and programmes
 * are not held yet, so the page does not show them.
 */
function CompanyPage({ organization, solutions, more, deployments }: CompanyPageProps) {
  const detail = useTranslations("Solution.detail");
  const directory = useTranslations("Solution.directory");
  const lists = useTranslations("Lists");
  const type = useVocabulary("organizationType");
  const industry = useVocabulary("industry");
  const countryName = useCountryName();
  const country = organization.country ? countryName(organization.country) : undefined;
  const kind = [type(organization.type), country].filter(Boolean).join(" · ");
  const facts = [
    { name: detail("company.type"), value: type(organization.type) },
    { name: detail("company.country"), value: country },
    {
      name: detail("company.industries"),
      value: organization.industries.map(industry).join(", "),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-8 px-5 pt-6 pb-18 md:px-8 md:pb-22 xl:px-16 xl:pb-24">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={siteRoutes.solutions} />}>
              {directory("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{organization.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-10">
          <header className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3.5">
              <OrganizationMark name={organization.name} logoFileId={organization.logoFileId} />
              <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl xl:text-5xl xl:leading-none">
                {organization.name}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">{kind}</p>
            {organization.description && (
              <p className="text-base md:text-lg md:leading-7">{organization.description}</p>
            )}
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {detail("company.solutions")}
              <span className="text-sm font-medium text-muted-foreground">{solutions.total}</span>
            </h2>
            {solutions.items.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {solutions.items.map((solution) => (
                  <li key={solution.slug}>
                    <CompanySolution solution={solution} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
                {detail("company.noSolutions")}
              </p>
            )}
            {solutions.items.length < solutions.total && more < MAX_COMPANY_PAGES && (
              <Button
                prominence="secondary"
                href={address(`${siteRoutes.organizations}/${organization.slug}`, {
                  more: more + 1,
                })}
                scroll={false}
                className="self-center"
              >
                {lists("loadMore")}
              </Button>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {detail("company.deployments")}
              <span className="text-sm font-medium text-muted-foreground">{deployments.total}</span>
            </h2>
            {deployments.items.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {deployments.items.map((deployment) => (
                  <li key={deployment.id}>
                    <CustomerDeploymentCard deployment={deployment} organization={organization} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted p-4 text-sm text-muted-foreground">
                {detail("company.noDeployments")}
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 lg:w-75 lg:shrink-0 xl:w-90">
          <dl className="flex flex-col border-b">
            {facts.map((fact) => (
              <div key={fact.name} className="flex items-start gap-4 border-t py-3 text-sm">
                <dt className="w-24 shrink-0 text-muted-foreground">{fact.name}</dt>
                {fact.value ? (
                  <dd className="font-medium">{fact.value}</dd>
                ) : (
                  <dd className="text-muted-foreground">{detail("unknown")}</dd>
                )}
              </div>
            ))}
            <div className="flex items-start gap-4 border-t py-3 text-sm">
              <dt className="w-24 shrink-0 text-muted-foreground">{detail("company.website")}</dt>
              <dd className="min-w-0">
                {organization.website ? (
                  <TextButton href={organization.website} target="_blank" rel="noreferrer">
                    <span className="truncate">
                      {organization.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                    </span>
                  </TextButton>
                ) : (
                  <span className="text-muted-foreground">{detail("unknown")}</span>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

export { CompanyPage };
