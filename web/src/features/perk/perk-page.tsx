import {
  ArrowUpRightIcon,
  BadgeCheckIcon,
  CalendarIcon,
  ListOrderedIcon,
  ScrollTextIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { PerkPage as PerkPageData } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerkAudience } from "./perk-audience";
import { PerkClaimPanel } from "./perk-claim-panel";

/** One fact of the panel: what it is, and its value; nothing when it has none. */
function Fact({
  icon,
  name,
  value,
}: {
  icon: React.ReactNode;
  name: string;
  value?: React.ReactNode;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        {name}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** A part of the page under its heading. */
function Part({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-xl font-semibold [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

type PerkPageProps = {
  page: PerkPageData;
  /** Where signing in leads, back to this page. */
  signInHref: string;
};

/**
 * One perk, laid out as a solution's page: what it is, how to get it, its terms and the solutions it
 * goes with, beside the panel that gets it and the facts of who may get it and until when. Who may get
 * it is read by anyone; a code or a private link comes only with a claim.
 */
function PerkPage({ page, signInHref }: PerkPageProps) {
  const t = useTranslations("Perk.page");
  const directory = useTranslations("Solution.directory");
  const format = useFormatter();
  const { card } = page;
  const day = (at: string) => format.dateTime(new Date(at), "date");
  const limit = t(page.perPerson ? "limit.person" : "limit.organization");

  return (
    <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-5 px-5 pt-4 pb-24 wrap-anywhere md:gap-7 md:px-8 md:pt-6 xl:px-16 desktop:px-20">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={siteRoutes.solutions} />}>
              {directory("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{card.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-start gap-3.5 md:gap-5">
        <OrganizationMark
          name={card.organizationName}
          logoFileId={card.organizationLogoFileId}
          size="wide"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          {card.value && (
            <p className="text-lg font-semibold text-primary md:text-xl">{card.value}</p>
          )}
          <h1 className="text-3xl font-semibold tracking-title text-balance md:text-4xl xl:text-5xl xl:leading-none">
            {card.title}
          </h1>
          <TextButton
            size="sm"
            href={`${siteRoutes.organizations}/${card.organizationSlug}`}
            className="max-w-full self-start wrap-anywhere whitespace-normal"
          >
            {t("by", { name: card.organizationName })}
          </TextButton>
          {card.fromGenAiFund && (
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <BadgeCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
              {t("fromGenAiFund")}
            </p>
          )}
          {card.summary && (
            <p className="text-base text-muted-foreground md:text-lg">{card.summary}</p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start xl:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-7 lg:order-none lg:flex-1 lg:gap-9">
          {page.about && (
            <Part icon={<TicketIcon aria-hidden="true" />} title={t("about")}>
              <p className="whitespace-pre-line text-muted-foreground">{page.about}</p>
            </Part>
          )}
          {page.steps.length > 0 && (
            <Part icon={<ListOrderedIcon aria-hidden="true" />} title={t("steps")}>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground marker:font-medium marker:text-foreground">
                {page.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </Part>
          )}
          {(page.terms || page.termsUrl) && (
            <Part icon={<ScrollTextIcon aria-hidden="true" />} title={t("terms")}>
              {page.terms && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">{page.terms}</p>
              )}
              {page.termsUrl && (
                <TextButton
                  href={page.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="self-start"
                >
                  {t("termsLink")}
                  <ArrowUpRightIcon aria-hidden="true" />
                </TextButton>
              )}
            </Part>
          )}
          {page.solutions.length > 0 && (
            <Part icon={<BadgeCheckIcon aria-hidden="true" />} title={t("solutions")}>
              <ul className="flex flex-wrap gap-2">
                {page.solutions.map((solution) => (
                  <li key={solution.id}>
                    <TextButton href={`${siteRoutes.solutions}/${solution.slug}`}>
                      {solution.name}
                    </TextButton>
                  </li>
                ))}
              </ul>
            </Part>
          )}
        </div>

        {/* Beside the page on a wide screen, the way to get the perk stays in view under the site header. */}
        <aside className="order-1 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:p-6 lg:sticky lg:top-23 lg:order-none lg:w-75 lg:shrink-0 xl:w-95">
          <PerkClaimPanel page={page} signInHref={signInHref} />
          <Separator />
          <dl className="flex flex-col gap-3">
            <Fact
              icon={<UsersIcon aria-hidden="true" />}
              name={t("facts.audience")}
              value={<PerkAudience audience={card.audience} programName={card.programName} />}
            />
            {card.programSlug && (
              <TextButton
                size="sm"
                href={`${siteRoutes.programs}/${card.programSlug}`}
                className="self-start"
              >
                {t("facts.program", { program: card.programName ?? "" })}
              </TextButton>
            )}
            <Fact icon={<UsersIcon aria-hidden="true" />} name={t("facts.limit")} value={limit} />
            <Fact
              icon={<TicketIcon aria-hidden="true" />}
              name={t("facts.places")}
              value={
                page.placesLeft === null || page.placesLeft === undefined
                  ? undefined
                  : t("facts.placesLeft", { count: page.placesLeft })
              }
            />
            <Fact
              icon={<CalendarIcon aria-hidden="true" />}
              name={t("facts.starts")}
              value={page.startsAt ? day(page.startsAt) : undefined}
            />
            <Fact
              icon={<CalendarIcon aria-hidden="true" />}
              name={t("facts.ends")}
              value={card.endsAt ? day(card.endsAt) : undefined}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

export { PerkPage };
