import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicSolution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { CustomerDeploymentCard } from "./customer-deployment-card";
import { SolutionLogo } from "./solution-logo";

const evidenceVariants = cva("flex flex-col items-start gap-2 rounded-xl border p-4", {
  variants: {
    state: {
      known: "bg-background",
      unknown: "border-dashed bg-muted text-muted-foreground",
    },
  },
});

/** One piece of evidence about a solution; dashed when what it would state is not known. */
function Evidence({
  state,
  ...props
}: React.ComponentProps<"div"> & Required<VariantProps<typeof evidenceVariants>>) {
  return <div data-slot="evidence" className={evidenceVariants({ state })} {...props} />;
}

const factVariants = cva("flex flex-col gap-0.5 p-4", {
  variants: {
    look: {
      tile: "rounded-xl bg-muted",
      ruled: "border-t",
    },
  },
});

type FactProps = Required<VariantProps<typeof factVariants>> & {
  name: string;
  /** Absent when the solution does not state it; the fact then reads as unknown. */
  value: string | undefined;
  unknown: string;
};

/** A named fact of a solution inside a list of facts. */
function Fact({ look, name, value, unknown }: FactProps) {
  return (
    <div data-slot="fact" className={factVariants({ look })}>
      <dt className="text-xs text-muted-foreground">{name}</dt>
      {value ? (
        <dd className="text-sm font-medium">{value}</dd>
      ) : (
        <dd className="text-sm font-medium text-muted-foreground">{unknown}</dd>
      )}
    </div>
  );
}

type SolutionPageProps = {
  solution: PublicSolution;
  /** The editor of this solution, when the visitor may change it. */
  editHref?: string;
};

/**
 * One solution of the public directory: what it is and who offers it, then what it says about
 * itself, its proof and where it fits, beside the way to reach its company. What a solution cannot
 * state yet is shown as unknown, never filled in.
 */
function SolutionPage({ solution, editHref }: SolutionPageProps) {
  const t = useTranslations("Solution.detail");
  const directory = useTranslations("Solution.directory");
  const view = useTranslations("Solution.view");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");
  const countryName = useCountryName();

  const unknown = t("unknown");
  const company = `${siteRoutes.organizations}/${solution.organizationSlug}`;
  const country = solution.country ? countryName(solution.country) : undefined;
  const answers = [
    { title: view("problemsSolved"), body: solution.problemsSolved },
    { title: view("valueProposition"), body: solution.valueProposition },
  ].filter((answer) => answer.body);

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-4 pb-24 md:gap-7 md:px-8 md:pt-6 xl:px-16">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={siteRoutes.solutions} />}>
              {directory("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{solution.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {editHref && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm">{directory("ownLead")}</p>
          <Button href={editHref} prominence="secondary">
            {directory("ownEdit")}
          </Button>
        </div>
      )}

      <header className="flex items-start gap-3.5 md:items-center md:gap-5">
        <SolutionLogo name={solution.name} size="page" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl xl:text-5xl xl:leading-none">
            {solution.name}
          </h1>
          <TextButton size="sm" href={company} className="self-start">
            {directory("by", { name: solution.organizationName })}
            <ArrowRightIcon aria-hidden="true" />
          </TextButton>
          {solution.summary && (
            <p className="text-base text-muted-foreground md:text-lg">{solution.summary}</p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start xl:gap-12">
        <div className="flex min-w-0 flex-1 flex-col gap-7 lg:gap-9">
          {answers.map((answer) => (
            <section key={answer.title} className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">{answer.title}</h2>
              <p className="whitespace-pre-line text-muted-foreground">{answer.body}</p>
            </section>
          ))}

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{t("proof.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("proof.lead")}</p>
            </div>
            {solution.customerDeployments.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {solution.customerDeployments.map((deployment) => (
                  <li key={deployment.id}>
                    <CustomerDeploymentCard
                      deployment={deployment}
                      organization={{
                        name: solution.organizationName,
                        slug: solution.organizationSlug,
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Evidence state="unknown">
                <Badge variant="outline">{t("proof.customerCase")}</Badge>
                <p className="text-sm">{t("proof.noCase")}</p>
              </Evidence>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t("fit.title")}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact
                look="tile"
                name={t("fit.industries")}
                value={solution.industries.map(industry).join(", ")}
                unknown={unknown}
              />
              <Fact look="tile" name={t("fit.channels")} value={undefined} unknown={unknown} />
              <Fact
                look="tile"
                name={t("fit.deployment")}
                value={solution.deployment.map(deployment).join(", ")}
                unknown={unknown}
              />
              <Fact look="tile" name={t("fit.languages")} value={undefined} unknown={unknown} />
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t("product.title")}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact
                look="ruled"
                name={t("product.capabilities")}
                value={solution.focusAreas.map(focusArea).join(", ")}
                unknown={unknown}
              />
              <Fact
                look="ruled"
                name={t("product.stage")}
                value={solution.maturity && maturity(solution.maturity)}
                unknown={unknown}
              />
            </dl>
            <p className="text-sm text-muted-foreground">{t("product.notPublished")}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">{t("offers.title")}</h2>
            <Evidence state="unknown">
              <Badge variant="outline">{t("offers.kind")}</Badge>
              <p className="text-sm">{t("offers.none")}</p>
            </Evidence>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t("company.title")}</h2>
            <Evidence state="known">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">{solution.organizationName}</p>
                {country && <Badge variant="outline">{country}</Badge>}
              </div>
              <TextButton href={company}>
                {t("company.view")}
                <ArrowRightIcon aria-hidden="true" />
              </TextButton>
            </Evidence>
          </section>
        </div>

        <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:p-6 lg:w-75 lg:shrink-0 xl:w-95">
          <h2 className="text-base font-medium">
            {t("contact.title", { name: solution.organizationName })}
          </h2>
          {solution.website && (
            <>
              <Button
                prominence="secondary"
                size="lg"
                href={solution.website}
                target="_blank"
                rel="noreferrer"
                className="w-full"
              >
                {t("contact.website")}
              </Button>
              <Separator />
            </>
          )}
          <dl className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{t("contact.basedIn")}</dt>
            {country ? (
              <dd className="text-sm font-medium">{country}</dd>
            ) : (
              <dd className="text-sm font-medium text-muted-foreground">{unknown}</dd>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}

export { SolutionPage };
