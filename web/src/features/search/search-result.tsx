import Image from "next/image";
import { BriefcaseBusinessIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { daysText, programFormatter } from "@/features/program/program-format";
import { SolutionLogo } from "@/features/solution/solution-logo";
import { TalentPhoto } from "@/features/talent/talent-photo";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { SearchItem } from "@/lib/api/generated";
import { programRoute, siteRoutes, useCaseRoute } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { budgetFigures, budgetText } from "@/features/usecase/use-case-budget";

import { snippetParts } from "./search-snippet";

/** The badge of a program's phase, as its page shows it: open is the one that takes action. */
const phaseVariant = {
  open: "success",
  upcoming: "info",
  running: "info",
  done: "outline",
} as const;

/** How many capabilities a solution's line names. */
const CAPABILITY_LIMIT = 2;

/**
 * One result, the same row for every kind: a picture, the name, who or what it is, the text it
 * matched in with the matched words in bold, and one line of facts of its kind. The whole row leads
 * to the item through the name's link.
 */
function SearchResult({ item }: { item: SearchItem }) {
  if (item.kind === "program") {
    return <ProgramResult item={item} />;
  }
  if (item.kind === "solution") {
    return <SolutionResult item={item} />;
  }
  if (item.kind === "use_case") {
    return <UseCaseResult item={item} />;
  }
  return <TalentResult item={item} />;
}

function ProgramResult({ item }: { item: SearchItem }) {
  const t = useTranslations("Program");
  const format = programFormatter(useLocale());
  const subtitle = [item.subtitle, item.type && t(`type.${item.type as "event"}`)]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row
      picture={
        item.coverFileId ? (
          <Image
            src={publicFileUrl(item.coverFileId)}
            alt=""
            width={112}
            height={72}
            className="h-14 w-18 shrink-0 rounded-lg border object-cover md:h-18 md:w-28"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-14 w-18 shrink-0 rounded-lg bg-accent md:h-18 md:w-28"
          />
        )
      }
      title={item.title}
      href={item.externalUrl ?? programRoute(item.slug)}
      external={Boolean(item.externalUrl)}
      subtitle={subtitle}
      snippet={item.snippet}
    >
      {(item.phase || (item.startsOn && item.endsOn)) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {item.phase && (
            <Badge variant={phaseVariant[item.phase]}>{t(`page.phase.${item.phase}`)}</Badge>
          )}
          {item.startsOn && item.endsOn && (
            <span className="text-xs text-muted-foreground">
              {daysText(format, item.startsOn, item.endsOn)}
            </span>
          )}
        </div>
      )}
    </Row>
  );
}

function SolutionResult({ item }: { item: SearchItem }) {
  const t = useTranslations("Search");
  const focusArea = useVocabulary("focusArea");
  // A solution without a customer case says nothing about it: an absence is not a fact of the row.
  const customerCases = item.customerDeployments ?? 0;
  const facts = [
    ...item.focusAreas.slice(0, CAPABILITY_LIMIT).map(focusArea),
    customerCases > 0 && t("customerCases", { count: customerCases }),
  ].filter(Boolean);
  // An organization that carries its solution's name would only repeat the title.
  const byline = item.subtitle && !sameName(item.subtitle, item.title) ? item.subtitle : null;

  return (
    <Row
      picture={<SolutionLogo name={item.title} fileId={item.photoFileId} size="card" />}
      title={item.title}
      href={`${siteRoutes.solutions}/${item.slug}`}
      subtitle={byline ? t("by", { name: byline }) : null}
      snippet={item.snippet}
    >
      {facts.length > 0 && <p className={factsLine}>{facts.join(" · ")}</p>}
    </Row>
  );
}

function TalentResult({ item }: { item: SearchItem }) {
  const role = useVocabulary("talentRole");
  const countryName = useCountryName();
  const subtitle = [item.roles[0] && role(item.roles[0]), item.country && countryName(item.country)]
    .filter(Boolean)
    .join(" · ");

  return (
    <Row
      picture={<TalentPhoto name={item.title} photoFileId={item.photoFileId} size="xl" />}
      title={item.title}
      href={`${siteRoutes.talent}/${item.slug}`}
      subtitle={subtitle}
      snippet={item.snippet}
    />
  );
}

/**
 * A use case, said the way the use cases list says it: who asks (or that they stay anonymous), the
 * industry, the budget when it is shown, and the date proposals close. It leads to the use case's own
 * page, whose address is the identifier the result carries as its `slug`.
 */
function UseCaseResult({ item }: { item: SearchItem }) {
  const t = useTranslations("UseCases");
  const industryName = useVocabulary("industry");
  const format = useFormatter();
  const locale = useLocale();
  const budget = item.budgetToBeDetermined
    ? t("budget.toBeDetermined")
    : item.budgetMin == null || item.budgetMax == null
      ? t("budget.membersOnly")
      : budgetText(
          budgetFigures(item.budgetMin, item.budgetMax, item.currency, locale),
          (key, values) => t(`budget.${key}`, values),
        );
  const facts = [
    item.industries[0] && industryName(item.industries[0]),
    budget,
    item.closesAt &&
      t("deadline.date", {
        date: format.dateTime(new Date(item.closesAt), "date"),
      }),
  ].filter(Boolean);

  return (
    <Row
      picture={
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-accent text-primary"
        >
          <BriefcaseBusinessIcon className="size-5" />
        </div>
      }
      title={item.title}
      href={useCaseRoute(item.slug)}
      subtitle={item.subtitle ?? t("anonymous")}
      snippet={item.snippet}
    >
      {facts.length > 0 && <p className={factsLine}>{facts.join(" · ")}</p>}
    </Row>
  );
}

/** Whether two names are one, whatever their case and the space around them. */
function sameName(one: string, other: string) {
  return one.trim().toLocaleLowerCase() === other.trim().toLocaleLowerCase();
}

/**
 * The line of facts under a result. On a phone it may take a second line, as the title may: what
 * tells two results apart, and a closing date, are at the end of their line.
 */
const factsLine = "text-xs text-muted-foreground max-md:line-clamp-2 md:truncate";

type RowProps = {
  picture: ReactNode;
  title: string;
  href: string;
  external?: boolean;
  subtitle?: string | null;
  snippet: string;
  children?: ReactNode;
};

function Row({ picture, title, href, external, subtitle, snippet, children }: RowProps) {
  const link = "outline-none after:absolute after:inset-0";
  return (
    <article className="relative flex gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 has-[h3>a:focus-visible]:ring-3 has-[h3>a:focus-visible]:ring-ring/50 has-[h3>a:focus-visible]:ring-inset md:gap-4 md:px-5 md:py-4">
      {picture}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base font-medium break-words max-md:line-clamp-2 md:truncate">
          {external ? (
            <a href={href} className={link}>
              {title}
            </a>
          ) : (
            <Link href={href} className={link}>
              {title}
            </Link>
          )}
        </h3>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
        )}
        {snippet && <Snippet text={snippet} />}
        {children}
      </div>
    </article>
  );
}

/** The text a result matched in, its matched words in bold. */
function Snippet({ text }: { text: string }) {
  return (
    <p className="line-clamp-2 text-sm text-muted-foreground">
      {snippetParts(text).map((part, index) =>
        part.matched ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.text}
          </strong>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}

export { SearchResult };
