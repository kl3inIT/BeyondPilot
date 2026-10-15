import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { ListFooter } from "@/components/composites/list-footer";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProgramEvent, ProgramSummary, SearchResults } from "@/lib/api/generated";
import { programApplyRoute, programRoute, siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";
import { gridPageSizes, maxSearchPage } from "@/lib/page-size";

import { ProgramCountdown } from "./program-countdown";
import {
  daysText,
  deadlineText,
  placeOf,
  programFormatter,
  vietnamDay,
  whenText,
  type ProgramFormat,
} from "./program-format";
import { ProgramsPublicFilters } from "./programs-public-filters";
import {
  listedAsEvent,
  openCardEvents,
  serializeProgramsPublicSearch,
  type ProgramsPublicSearch,
  type ProgramGroups,
} from "./programs-public-search";

type Format = ProgramFormat;

/** Where a program is read: its page here, or the page somewhere else it lives on. */
function hrefOf(program: Pick<ProgramSummary, "slug" | "pageKind" | "externalUrl">) {
  return program.pageKind === "external" && program.externalUrl
    ? program.externalUrl
    : programRoute(program.slug);
}

function SectionHead({ title, count }: { title: string; count?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-xl font-semibold tracking-title">{title}</h2>
      {count && <span className="text-sm text-muted-foreground">{count}</span>}
    </div>
  );
}

/**
 * Programs and events: what can be applied to now, what is coming up, and what GenAI Fund has run,
 * by year. A program opens on its page, or on the page somewhere else it lives on.
 */
async function ProgramsPage({
  groups,
  search,
  results,
  ranked,
}: {
  groups: ProgramGroups;
  search: ProgramsPublicSearch;
  results: SearchResults | null;
  ranked?: ProgramSummary[];
}) {
  const [t, types, locale] = await Promise.all([
    getTranslations("Programs"),
    getTranslations("Program.type"),
    getLocale(),
  ]);
  const format = programFormatter(locale);
  const current =
    search.phase === "open"
      ? t("open")
      : search.phase === "upcoming"
        ? t("upcoming")
        : t("current");
  const byYear = new Map<number, ProgramSummary[]>();
  for (const program of groups.done) {
    const year = program.endsOn ? vietnamDay(program.endsOn).getFullYear() : 0;
    byYear.set(year, [...(byYear.get(year) ?? []), program]);
  }
  const empty = results ? ranked?.length === 0 : groups.current.length + groups.done.length === 0;

  return (
    <div className="flex-1 bg-muted" lang={locale}>
      <div className="mx-auto flex w-full max-w-360 flex-col gap-10 px-5 py-10 md:px-8 md:py-14 xl:px-16 desktop:px-20">
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">{t("title")}</h1>
          <p className="text-muted-foreground md:text-lg">{t("lead")}</p>
        </header>

        <ProgramsPublicFilters counts={groups.counts} />

        {results && (
          <>
            <div className="flex flex-col gap-4">
              {ranked?.map((program) =>
                program.phase === "open" || program.phase === "running" ? (
                  <ProgramCard
                    key={program.slug}
                    program={program}
                    kind={types(program.type)}
                    format={format}
                  />
                ) : (
                  <ul key={program.slug} className="flex flex-col gap-3">
                    {program.phase === "upcoming" ? (
                      <UpcomingProgram
                        program={program}
                        kind={types(program.type)}
                        format={format}
                      />
                    ) : (
                      <DoneProgram program={program} kind={types(program.type)} format={format} />
                    )}
                  </ul>
                ),
              )}
            </div>
            <ListFooter
              count={t("programCount", { count: results.total })}
              page={results.page}
              pageSize={results.pageSize}
              total={results.total}
              href={(page) =>
                serializeProgramsPublicSearch(siteRoutes.programs, { ...search, page })
              }
              sizes={gridPageSizes}
              maxPages={maxSearchPage}
            />
          </>
        )}

        {!results && groups.current.length > 0 && (
          <section className="flex flex-col gap-4" aria-label={current}>
            <SectionHead title={current} />
            {groups.current.map((listing, index) =>
              listing.kind === "program" ? (
                <ProgramCard
                  key={listing.program.slug}
                  program={listing.program}
                  preload={index === 0}
                  kind={types(listing.program.type)}
                  format={format}
                />
              ) : (
                <EventCard
                  key={`${listing.program.slug}-${listing.event.startsAt}-${listing.event.title}`}
                  program={listing.program}
                  event={listing.event}
                  preload={index === 0}
                  format={format}
                />
              ),
            )}
          </section>
        )}

        {!results && groups.done.length > 0 && (
          <section className="flex flex-col gap-4" aria-label={t("done")}>
            <SectionHead title={t("done")} />
            {[...byYear.entries()].map(([year, programs]) => (
              <div key={year} className="flex flex-col gap-3 md:flex-row md:gap-8">
                <h3 className="text-sm font-medium md:w-20 md:shrink-0 md:pt-1">
                  {year || t("undated")}
                </h3>
                <ul className="grid flex-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
                  {programs.map((program) => (
                    <DoneProgram
                      key={program.slug}
                      program={program}
                      kind={types(program.type)}
                      format={format}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {empty && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6">
            <p className="font-medium">{t("empty.title")}</p>
            <Button prominence="secondary" size="sm" href={siteRoutes.programs}>
              {t("empty.clear")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The frame every card of the list of what is open and coming up shares: the cover, or the name on
 * the brand colour without one, beside what the card says.
 */
function ListingFrame({
  cover,
  name,
  preload,
  children,
}: {
  cover: string | null | undefined;
  name: string;
  /** The first card preloads its cover, the largest paint of the page on a phone. */
  preload: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-1 rounded-3xl border bg-card p-2 text-card-foreground shadow-raised md:gap-2 md:p-3 xl:flex-row xl:gap-8">
      <div className="relative h-55 shrink-0 overflow-hidden rounded-xl bg-primary xl:h-auto xl:min-h-64 xl:w-120">
        {cover ? (
          <Image
            src={publicFileUrl(cover)}
            alt=""
            fill
            preload={preload}
            sizes="(min-width: 1280px) 30rem, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col justify-end bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-5 md:p-7">
            <p className="text-2xl font-semibold text-primary-foreground md:text-3xl">{name}</p>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-2.5 pt-4 pb-3 md:gap-4 md:pt-5 md:pr-4 md:pb-5 md:pl-3 xl:pl-0">
        {children}
      </div>
    </article>
  );
}

/** What a card is, a program or an event, and where it stands, above its title. */
function ListingHead({
  label,
  status,
  detail,
}: {
  label: string;
  status?: React.ReactNode;
  detail?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
      <Badge variant="outline">{label}</Badge>
      {status}
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

/**
 * A program taking applications, running after they closed, or coming up: what to decide whether
 * to apply.
 */
async function ProgramCard({
  program,
  kind,
  format,
  preload = false,
}: {
  program: ProgramSummary;
  kind: string;
  format: Format;
  preload?: boolean;
}) {
  const t = await getTranslations("Programs");
  const applications = program.applications;
  const open = program.phase === "open";
  const upcoming = program.phase === "upcoming";
  const apply = programApplyRoute(program.slug);
  const facts = program.upcomingEvents.slice(0, openCardEvents);

  return (
    <ListingFrame cover={program.coverFileId} name={program.name} preload={preload}>
      <ListingHead
        label={t("kind.program")}
        status={
          <Badge variant={open ? "success" : upcoming ? "secondary" : "info"}>
            {t(open ? "live" : upcoming ? "upcoming" : "running")}
          </Badge>
        }
        detail={[kind, program.partnerName].filter(Boolean).join(" · ")}
      />
      <h3 className="text-2xl font-semibold md:text-3xl md:tracking-title">
        <Link
          href={hrefOf(program)}
          className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {program.name}
        </Link>
      </h3>
      {open && applications ? (
        <p className="text-base font-medium text-primary md:text-lg md:font-normal">
          <ProgramCountdown
            deadline={applications.closesAt}
            closes={deadlineText(format, applications)}
          />
        </p>
      ) : upcoming ? (
        <p className="text-base font-medium text-primary md:text-lg md:font-normal">
          {applications
            ? t("opensOn", { date: format.dateTime(new Date(applications.opensAt), "day") })
            : program.startsOn && program.endsOn
              ? daysText(format, program.startsOn, program.endsOn)
              : program.summary}
        </p>
      ) : (
        program.summary && <p className="text-muted-foreground">{program.summary}</p>
      )}
      {facts.length > 0 && (
        <dl
          aria-label={t("nextUp")}
          className="flex flex-col gap-2.5 border-y py-3.5 md:flex-row md:gap-6 md:py-5"
        >
          {facts.map((event) => (
            <div key={`${event.startsAt}-${event.title}`} className="flex flex-col gap-1 md:flex-1">
              <dt className="text-xs font-medium text-muted-foreground">{event.title}</dt>
              <dd className="text-sm font-semibold md:text-lg">{whenText(format, event)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        {open && apply && (
          <Button size="lg" href={apply}>
            {t("applyNow")}
          </Button>
        )}
        <Button
          size="lg"
          prominence={open && apply ? "secondary" : "primary"}
          href={hrefOf(program)}
        >
          {t("readBrief")}
        </Button>
      </div>
    </ListingFrame>
  );
}

/**
 * An event still to come, of a program that is an event and nothing else: its day and place, and
 * where to register, on the same card as a program, as the sites that list Luma events do.
 */
async function EventCard({
  program,
  event,
  format,
  preload = false,
}: {
  program: ProgramSummary;
  event: ProgramEvent;
  format: Format;
  preload?: boolean;
}) {
  const t = await getTranslations("Programs");
  return (
    <ListingFrame
      cover={listedAsEvent(program) ? program.coverFileId : null}
      name={event.title}
      preload={preload}
    >
      <ListingHead
        label={t("kind.event")}
        detail={program.name === event.title ? null : program.name}
      />
      <h3 className="text-2xl font-semibold md:text-3xl md:tracking-title">
        <Link
          href={hrefOf(program)}
          className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {event.title}
        </Link>
      </h3>
      <p className="text-base font-medium text-primary md:text-lg md:font-normal">
        <time dateTime={event.startsAt}>
          {[whenText(format, event), placeOf(event, t("online"))].filter(Boolean).join(" · ")}
        </time>
      </p>
      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        {event.registrationUrl ? (
          <Button size="lg" href={event.registrationUrl}>
            {t("register")}
            <ArrowUpRightIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button size="lg" href={hrefOf(program)}>
            {t("readPage")}
          </Button>
        )}
      </div>
    </ListingFrame>
  );
}

/** A program that has not started yet. */
async function UpcomingProgram({
  program,
  kind,
  format,
}: {
  program: ProgramSummary;
  kind: string;
  format: Format;
}) {
  const t = await getTranslations("Programs");
  const applications = program.applications;
  return (
    <li className="relative flex flex-col gap-1 rounded-xl border bg-card px-4.5 py-3.5 shadow-card md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {[kind, program.partnerName].filter(Boolean).join(" · ")}
        </p>
        <Link
          href={hrefOf(program)}
          className="text-sm font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          {program.name}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {applications
          ? t("opensOn", {
              date: format.dateTime(new Date(applications.opensAt), "day"),
            })
          : program.startsOn && program.endsOn
            ? daysText(format, program.startsOn, program.endsOn)
            : null}
      </p>
    </li>
  );
}

/** A program GenAI Fund has run: its cover, what and when, and where to read about it. */
async function DoneProgram({
  program,
  kind,
  format,
}: {
  program: ProgramSummary;
  kind: string;
  format: Format;
}) {
  const t = await getTranslations("Programs");
  const ended = program.endsOn ? format.dateTime(vietnamDay(program.endsOn), "date") : null;
  const external = program.pageKind === "external" && program.externalUrl;
  return (
    <li className="relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card">
      {program.coverFileId ? (
        <Image
          src={publicFileUrl(program.coverFileId)}
          alt=""
          width={480}
          height={180}
          className="h-37.5 w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="h-37.5 bg-accent" />
      )}
      <div className="flex flex-col gap-1 px-4.5 pt-4 pb-4.5">
        <p className="text-xs font-medium text-muted-foreground">
          {[kind, ended].filter(Boolean).join(" · ")}
        </p>
        <Link
          href={hrefOf(program)}
          className="text-base font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
        >
          {program.name}
        </Link>
        <p className="text-xs font-medium text-primary">{t(external ? "readRecap" : "readPage")}</p>
      </div>
    </li>
  );
}

export { ProgramsPage };
