import { ArrowUpRightIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ProgramEvent, ProgramSummary } from "@/lib/api/generated";
import { programApplyUrl, programRoute, siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

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
import { openCardEvents, type groupPrograms } from "./programs-public-search";

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
async function ProgramsPage({ groups }: { groups: ReturnType<typeof groupPrograms> }) {
  const [t, types, locale] = await Promise.all([
    getTranslations("Programs"),
    getTranslations("Program.type"),
    getLocale(),
  ]);
  const format = programFormatter(locale);
  const comingUp = groups.upcoming.length + groups.events.length;
  const byYear = new Map<number, ProgramSummary[]>();
  for (const program of groups.done) {
    const year = program.endsOn ? vietnamDay(program.endsOn).getFullYear() : 0;
    byYear.set(year, [...(byYear.get(year) ?? []), program]);
  }
  const empty = groups.open.length + comingUp + groups.done.length === 0;

  return (
    <div className="bg-muted" lang={locale}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">{t("title")}</h1>
          <p className="text-muted-foreground md:text-lg">{t("lead")}</p>
        </header>

        <ProgramsPublicFilters counts={groups.counts} />

        {groups.open.length > 0 && (
          <section className="flex flex-col gap-4" aria-label={t("open")}>
            <SectionHead
              title={t("open")}
              count={t("programCount", { count: groups.open.length })}
            />
            {groups.open.map((program) => (
              <OpenProgram
                key={program.slug}
                program={program}
                kind={types(program.type)}
                format={format}
              />
            ))}
          </section>
        )}

        {comingUp > 0 && (
          <section className="flex flex-col gap-3" aria-label={t("upcoming")}>
            <SectionHead title={t("upcoming")} count={t("itemCount", { count: comingUp })} />
            <ul className="flex flex-col gap-3">
              {groups.events.map(({ program, event }) => (
                <EventRow
                  key={`${program.slug}-${event.startsAt}-${event.title}`}
                  kicker={program.name}
                  event={event}
                  format={format}
                />
              ))}
              {groups.upcoming.map((program) => (
                <UpcomingProgram
                  key={program.slug}
                  program={program}
                  kind={types(program.type)}
                  format={format}
                />
              ))}
            </ul>
          </section>
        )}

        {groups.done.length > 0 && (
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
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
            <Button prominence="secondary" size="sm" href={siteRoutes.programs}>
              {t("empty.clear")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A program taking applications, or running after they closed: what to decide whether to apply. */
async function OpenProgram({
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
  const open = program.phase === "open";
  const apply = programApplyUrl(program.slug);
  const facts = program.upcomingEvents.slice(0, openCardEvents);

  return (
    <article className="flex flex-col gap-1 rounded-3xl border bg-card p-2 text-card-foreground shadow-raised md:gap-2 md:p-3 xl:flex-row xl:gap-8">
      <div className="relative h-55 shrink-0 overflow-hidden rounded-xl bg-primary xl:h-auto xl:min-h-64 xl:w-120">
        {program.coverFileId ? (
          <Image
            src={publicFileUrl(program.coverFileId)}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1280px) 30rem, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col justify-end bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-5 md:p-7">
            <p className="text-2xl font-semibold text-primary-foreground md:text-3xl">
              {program.name}
            </p>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-2.5 pt-4 pb-3 md:gap-4 md:pt-5 md:pr-4 md:pb-5 md:pl-3 xl:pl-0">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-2.5">
          <Badge variant={open ? "success" : "info"}>{t(open ? "live" : "running")}</Badge>
          <p className="text-sm text-muted-foreground">
            {[kind, program.partnerName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <h3 className="text-2xl font-semibold md:text-3xl md:tracking-title">
          <Link href={hrefOf(program)} className="outline-none focus-visible:underline">
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
        ) : (
          program.summary && <p className="text-muted-foreground">{program.summary}</p>
        )}
        {facts.length > 0 && (
          <dl
            aria-label={t("nextUp")}
            className="flex flex-col gap-2.5 border-y py-3.5 md:flex-row md:gap-6 md:py-5"
          >
            {facts.map((event) => (
              <div
                key={`${event.startsAt}-${event.title}`}
                className="flex flex-col gap-1 md:flex-1"
              >
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
      </div>
    </article>
  );
}

/** A session still to come: its day, what it is, and where to register. */
async function EventRow({
  kicker,
  event,
  format,
}: {
  kicker: string;
  event: ProgramEvent;
  format: Format;
}) {
  const t = await getTranslations("Programs");
  const starts = new Date(event.startsAt);
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card py-3.5 pr-4.5 pl-3.5 shadow-card md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3.5">
        <time
          dateTime={event.startsAt}
          className="flex h-14 w-13 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted"
        >
          <span className="text-xs font-semibold text-primary uppercase">
            {format.dateTime(starts, { month: "short" })}
          </span>
          <span className="text-lg font-semibold">
            {format.dateTime(starts, { day: "numeric" })}
          </span>
        </time>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">{kicker}</p>
          <p className="text-sm font-semibold">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {[whenText(format, event), placeOf(event, t("online"))].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {event.registrationUrl && (
        <Button size="sm" prominence="secondary" href={event.registrationUrl}>
          {t("register")}
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      )}
    </li>
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
          className="text-sm font-semibold outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {program.name}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {applications
          ? t("opensOn", {
              date: format.dateTime(new Date(applications.opensAt), {
                day: "numeric",
                month: "short",
              }),
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
  const ended = program.endsOn
    ? format.dateTime(vietnamDay(program.endsOn), {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const external = program.pageKind === "external" && program.externalUrl;
  return (
    <li className="relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card">
      {program.coverFileId ? (
        <Image
          src={publicFileUrl(program.coverFileId)}
          alt=""
          width={480}
          height={180}
          unoptimized
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
          className="text-base font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {program.name}
        </Link>
        <p className="text-xs font-medium text-primary">{t(external ? "readRecap" : "readPage")}</p>
      </div>
    </li>
  );
}

export { ProgramsPage };
