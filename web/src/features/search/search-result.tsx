import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { daysText, programFormatter } from "@/features/program/program-format";
import { SolutionLogo } from "@/features/solution/solution-logo";
import { TalentPhoto } from "@/features/talent/talent-photo";
import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { SearchItem } from "@/lib/api/generated";
import { programRoute, siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

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
            unoptimized
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
  const facts = [
    ...item.focusAreas.slice(0, CAPABILITY_LIMIT).map(focusArea),
    item.customerDeployments !== null &&
      item.customerDeployments !== undefined &&
      t("customerCases", { count: item.customerDeployments }),
  ].filter(Boolean);

  return (
    <Row
      picture={<SolutionLogo name={item.title} size="card" />}
      title={item.title}
      href={`${siteRoutes.solutions}/${item.slug}`}
      subtitle={item.subtitle ? t("by", { name: item.subtitle }) : null}
      snippet={item.snippet}
    >
      {facts.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">{facts.join(" · ")}</p>
      )}
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
      picture={
        <TalentPhoto
          name={item.title}
          photoFileId={item.photoFileId}
          size={48}
          className="size-12 text-sm"
        />
      }
      title={item.title}
      href={`${siteRoutes.talent}/${item.slug}`}
      subtitle={subtitle}
      snippet={item.snippet}
    />
  );
}

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
        <h3 className="truncate text-base font-medium">
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
