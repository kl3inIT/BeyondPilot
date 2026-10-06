import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  Building2Icon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDollarSignIcon,
  CloudIcon,
  CpuIcon,
  DownloadIcon,
  FlagIcon,
  LanguagesIcon,
  LayersIcon,
  LinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { deckAddress, useFileSize } from "./solution-deck";
import { SolutionGallery } from "./solution-gallery";
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

const partHeadingVariants = cva(
  "flex items-center gap-2 text-xl font-semibold [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        plain: "[&_svg]:text-muted-foreground",
        /** What GenAI Fund checked. */
        proof: "[&_svg]:text-success",
      },
    },
    defaultVariants: { tone: "plain" },
  },
);

type PartHeadingProps = VariantProps<typeof partHeadingVariants> & {
  icon: React.ReactNode;
  children: React.ReactNode;
};

/** The heading of a part of the page, with the icon that says what kind of part it is. */
function PartHeading({ icon, tone, children }: PartHeadingProps) {
  return (
    <h2 className={partHeadingVariants({ tone })}>
      {icon}
      {children}
    </h2>
  );
}

type FactProps = {
  icon: React.ReactNode;
  name: string;
  /** Absent when the solution does not state it; the fact then reads as unknown. */
  value: string | undefined;
  unknown: string;
};

/** A named fact of a solution in the list beside the page. */
function Fact({ icon, name, value, unknown }: FactProps) {
  return (
    <div data-slot="fact" className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        {name}
      </dt>
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
  /** The way to ask for an introduction to its company, put in by the route that knows the visitor. */
  introduction?: React.ReactNode;
};

/**
 * One solution of the public directory: what it is and who offers it, what it shows of itself, what
 * it says and its proof, beside the one way to reach its company and its facts. What a solution
 * cannot state yet is shown as unknown, never filled in.
 */
function SolutionPage({ solution, editHref, introduction }: SolutionPageProps) {
  const t = useTranslations("Solution.detail");
  const directory = useTranslations("Solution.directory");
  const view = useTranslations("Solution.view");
  const industry = useVocabulary("industry");
  const focusArea = useVocabulary("focusArea");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");
  const language = useVocabulary("language");
  const countryName = useCountryName();
  const size = useFileSize();
  const format = useFormatter();

  const unknown = t("unknown");
  const company = `${siteRoutes.organizations}/${solution.organizationSlug}`;
  const country = solution.country ? countryName(solution.country) : undefined;
  // What the owners wrote as a list, one problem to a line, reads as a list.
  const problems = (solution.problemsSolved ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const cases = solution.customerDeployments.length;
  // What GenAI Fund says of it, as the line under the company's heading.
  const backing = [solution.backing?.backedBy, solution.backing?.program]
    .filter(Boolean)
    .join(" · ");
  const tags = [
    {
      key: "stage" as const,
      icon: <TrendingUpIcon aria-hidden="true" />,
      labels: solution.maturity ? [maturity(solution.maturity)] : [],
    },
    {
      key: "industries" as const,
      icon: <LayersIcon aria-hidden="true" />,
      labels: solution.industries.map(industry),
    },
    {
      key: "deployment" as const,
      icon: <CloudIcon aria-hidden="true" />,
      labels: solution.deployment.map(deployment),
    },
  ].filter((group) => group.labels.length > 0);

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

      {!solution.listed && (
        <Alert>
          <AlertDescription>{t("unlisted")}</AlertDescription>
        </Alert>
      )}

      {editHref && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm">{directory("ownLead")}</p>
          <Button href={editHref} prominence="secondary">
            {directory("ownEdit")}
          </Button>
        </div>
      )}

      <header className="flex items-start gap-3.5 md:gap-5">
        <SolutionLogo name={solution.name} fileId={solution.logoFileId} size="page" />
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
          {tags.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
              {tags.map((group) => (
                <li
                  key={group.key}
                  className="flex flex-wrap items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
                >
                  {group.icon}
                  <span className="sr-only">{t(`facts.${group.key}`)}</span>
                  {group.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {/* On a phone the way to reach the company comes right under the images, before the reading. */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start xl:gap-12">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-9">
          <div className="order-1 empty:hidden lg:order-none">
            <SolutionGallery
              name={solution.name}
              coverFileId={solution.coverFileId}
              imageFileIds={solution.imageFileIds}
            />
          </div>

          <div className="order-3 flex min-w-0 flex-col gap-7 lg:order-none lg:gap-9">
            {solution.valueProposition && (
              <section className="flex flex-col gap-2">
                <PartHeading icon={<SparklesIcon aria-hidden="true" />}>
                  {view("valueProposition")}
                </PartHeading>
                <p className="whitespace-pre-line text-muted-foreground">
                  {solution.valueProposition}
                </p>
              </section>
            )}

            {problems.length > 0 && (
              <section className="flex flex-col gap-2">
                <PartHeading icon={<CircleAlertIcon aria-hidden="true" />}>
                  {view("problemsSolved")}
                </PartHeading>
                {problems.length > 1 ? (
                  <ul className="flex flex-col gap-2 text-muted-foreground">
                    {problems.map((problem) => (
                      <li key={problem} className="flex items-start gap-2.5">
                        <CircleCheckIcon className="mt-1 size-4 shrink-0" aria-hidden="true" />
                        {problem}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{problems[0]}</p>
                )}
              </section>
            )}

            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <PartHeading tone="proof" icon={<BadgeCheckIcon aria-hidden="true" />}>
                  {t("proof.title")}
                </PartHeading>
                <p className="text-sm text-muted-foreground">{t("proof.lead")}</p>
              </div>
              {/* Each claim under its kind, with who stands behind it. */}
              {solution.backing?.program && (
                <Evidence state="known">
                  <Badge variant="outline">{t("proof.programme")}</Badge>
                  <p className="text-sm">
                    {t("proof.selected", { program: solution.backing.program })}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <BadgeCheckIcon className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                    {t("proof.byGenAiFund", {
                      date: format.dateTime(new Date(solution.backing.updatedAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </p>
                </Evidence>
              )}
              {solution.traction && (
                <Evidence state="known">
                  <Badge variant="outline">{t("proof.stated")}</Badge>
                  <p className="text-sm whitespace-pre-line">{solution.traction}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    {t("proof.byCompany", { name: solution.organizationName })}
                  </p>
                </Evidence>
              )}
              <Evidence state={cases > 0 ? "known" : "unknown"}>
                <Badge variant="outline">{t("proof.customerCase")}</Badge>
                <p className="text-sm">
                  {cases > 0 ? t("proof.cases", { count: cases }) : t("proof.noCase")}
                </p>
              </Evidence>
            </section>

            {cases > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <PartHeading icon={<UsersIcon aria-hidden="true" />}>
                    {t("references.title")}
                  </PartHeading>
                  <p className="text-sm text-muted-foreground">{t("references.lead")}</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {solution.customerDeployments.map((item) => (
                    <li key={item.id}>
                      <CustomerDeploymentCard
                        deployment={item}
                        organization={{
                          name: solution.organizationName,
                          slug: solution.organizationSlug,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <PartHeading icon={<Building2Icon aria-hidden="true" />}>
                  {t("company.title")}
                </PartHeading>
                {backing && <p className="text-sm text-muted-foreground">{backing}</p>}
              </div>
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
        </div>

        {/* Beside the page on a wide screen, the way to reach the company stays in view under the site header. */}
        <aside className="order-2 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:p-6 lg:sticky lg:top-23 lg:order-none lg:w-75 lg:shrink-0 xl:w-95">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-medium">
              {t("contact.title", { name: solution.organizationName })}
            </h2>
            {introduction && <p className="text-xs text-muted-foreground">{t("contact.lead")}</p>}
          </div>
          {introduction}
          {(solution.website || solution.demoUrl || solution.deck) && (
            <div className="flex flex-col items-center gap-1">
              {(
                [
                  ["website", solution.website],
                  ["demo", solution.demoUrl],
                ] as const
              ).map(
                ([key, href]) =>
                  href && (
                    <Button
                      key={key}
                      prominence="tertiary"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t(`contact.${key}`)}
                      <ArrowUpRightIcon aria-hidden="true" />
                    </Button>
                  ),
              )}
              {solution.deck && (
                <>
                  <Button
                    prominence="tertiary"
                    href={deckAddress(solution.slug)}
                    aria-describedby="solution-deck-file"
                  >
                    <DownloadIcon aria-hidden="true" />
                    {t("contact.deck")}
                  </Button>
                  <p id="solution-deck-file" className="text-center text-xs text-muted-foreground">
                    {solution.deck.fileName} · {size(solution.deck.sizeBytes)}
                  </p>
                </>
              )}
            </div>
          )}
          <Separator />
          <dl className="flex flex-col gap-3">
            <Fact
              icon={<MapPinIcon aria-hidden="true" />}
              name={t("contact.basedIn")}
              value={country}
              unknown={unknown}
            />
            <Fact
              icon={<ShieldCheckIcon aria-hidden="true" />}
              name={t("facts.backedBy")}
              value={solution.backing?.backedBy ?? undefined}
              unknown={unknown}
            />
            <Fact
              icon={<FlagIcon aria-hidden="true" />}
              name={t("facts.program")}
              value={solution.backing?.program ?? undefined}
              unknown={unknown}
            />
            <Fact
              icon={<LayersIcon aria-hidden="true" />}
              name={t("facts.industries")}
              value={solution.industries.map(industry).join(", ")}
              unknown={unknown}
            />
            <Fact
              icon={<CpuIcon aria-hidden="true" />}
              name={t("facts.capabilities")}
              value={solution.focusAreas.map(focusArea).join(", ")}
              unknown={unknown}
            />
            <Fact
              icon={<MessageCircleIcon aria-hidden="true" />}
              name={t("facts.channels")}
              value={solution.channels ?? undefined}
              unknown={unknown}
            />
            <Fact
              icon={<CloudIcon aria-hidden="true" />}
              name={t("facts.deployment")}
              value={solution.deployment.map(deployment).join(", ")}
              unknown={unknown}
            />
            <Fact
              icon={<LanguagesIcon aria-hidden="true" />}
              name={t("facts.languages")}
              value={solution.languages.map(language).join(", ")}
              unknown={unknown}
            />
            <Fact
              icon={<ZapIcon aria-hidden="true" />}
              name={t("facts.builtWith")}
              value={solution.builtWith.join(", ")}
              unknown={unknown}
            />
            <Fact
              icon={<TargetIcon aria-hidden="true" />}
              name={t("facts.bestCustomerProfile")}
              value={solution.bestCustomerProfile ?? undefined}
              unknown={unknown}
            />
            <Fact
              icon={<CircleDollarSignIcon aria-hidden="true" />}
              name={t("facts.funding")}
              value={solution.backing?.funding ?? undefined}
              unknown={unknown}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

export { SolutionPage };
