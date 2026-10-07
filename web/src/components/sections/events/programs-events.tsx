import { cva } from "class-variance-authority";
import { BanknoteIcon, PresentationIcon, TrophyIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/actions/button";
import { CampaignCountdown } from "@/components/sections/events/campaign-countdown";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { liveCampaignDeadline, liveCampaignUrl } from "@/lib/site";

type Stage = "open" | "coming" | "done";

/** A program that ended, as its card under Done shows it. */
export type PastProgram = {
  slug: string;
  name: string;
  type: string;
  partnerName: string | null;
  coverUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
};

/** What the strip shows besides the live campaign; a stop with nothing to show is left out. */
export type EventsData = {
  /** The next sessions of an event series; `recurring` is the GenAI Builders Meetup, whose hours are known. */
  meetup: { name: string; recurring: boolean; dates: string[] } | null;
  past: PastProgram[];
};

const stagePill = cva("inline-flex w-fit rounded-full px-3.5 py-1.5 text-sm font-semibold", {
  variants: {
    stage: {
      open: "bg-primary text-primary-foreground",
      coming: "border bg-card text-primary",
      done: "bg-accent text-muted-foreground",
    },
  },
});

// The 3px ring in the floor colour lifts each dot off the rail; Open now also carries the sky light.
const stageDot = cva("relative size-3.5 rounded-full ring-3 ring-muted", {
  variants: {
    stage: {
      open: "bg-primary shadow-glow",
      coming: "bg-primary",
      done: "bg-muted-foreground opacity-55",
    },
  },
});

/**
 * "What can I join now?": one azure rail with three stops (DESIGN.md › Timeline). The stage pill
 * sits in its own column from `md` and above the content on phones, where everything stacks.
 */
function ProgramsEvents({ data }: { data: EventsData }) {
  const t = useTranslations("Home.events");

  return (
    <Section surface="muted">
      <div className="py-14 md:py-18">
        <h2 className="pb-7 text-3xl font-semibold tracking-headline md:pb-10 md:text-headline">
          {t("title")}
        </h2>
        <ol>
          <Stop stage="open" label={t("open")}>
            <LiveCampaign />
          </Stop>
          {data.meetup && (
            <Stop stage="coming" label={t("coming")} last={data.past.length === 0}>
              <NextMeetup meetup={data.meetup} />
            </Stop>
          )}
          {data.past.length > 0 && (
            <Stop stage="done" label={t("done")} last>
              <PastPrograms programs={data.past} />
            </Stop>
          )}
        </ol>
      </div>
    </Section>
  );
}

function Stop({
  stage,
  label,
  last = false,
  children,
}: {
  stage: Stage;
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-10 md:gap-0 md:pb-14">
      {/* The rail runs from this dot's centre to the next one's. */}
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-3.75 -bottom-3.75 left-3.75 w-0.5 bg-primary/25 md:top-7.75 md:-bottom-7.75 md:left-38.75"
        />
      )}
      <div className="hidden w-35 shrink-0 pt-4 md:block">
        <h3 className={stagePill({ stage })}>{label}</h3>
      </div>
      <div className="flex w-8 shrink-0 justify-center pt-2 md:pt-6">
        <span aria-hidden="true" className={stageDot({ stage })} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className={stagePill({ stage, className: "md:hidden" })}>{label}</h3>
        {children}
      </div>
    </li>
  );
}

/** The live campaign: a cover with its question, then the facts that decide whether to apply. */
function LiveCampaign() {
  const c = useTranslations("Campaign");
  const facts = [
    { icon: PresentationIcon, label: c("facts.briefing"), value: c("facts.briefingWhen") },
    { icon: TrophyIcon, label: c("facts.demoDay"), value: c("facts.demoDayWhen") },
    { icon: BanknoteIcon, label: c("facts.investment"), value: c("facts.investmentValue") },
  ];

  return (
    <article className="flex flex-col gap-1 rounded-3xl border bg-card p-2 text-card-foreground shadow-raised md:gap-2 md:p-3 xl:flex-row xl:gap-8">
      <div className="flex h-55 shrink-0 flex-col justify-between gap-4 rounded-xl bg-primary bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-5 md:p-7 xl:h-auto xl:w-120 dark:from-transparent">
        {/* The two logos, in white on the cover; their names are what a screen reader hears. */}
        <p className="flex items-center gap-2.5">
          <Image
            src="/brand/genaifund-logo-white.png"
            alt="GenAI Fund"
            width={1200}
            height={254}
            className="h-5 w-auto"
          />
          <span aria-hidden="true" className="text-sm font-semibold text-primary-foreground">
            ×
          </span>
          <Image
            src="/programs/tasco/tasco-white.png"
            alt="Tasco"
            width={1238}
            height={178}
            className="h-3.5 w-auto"
          />
        </p>
        <p className="text-2xl font-semibold text-primary-foreground md:text-3xl md:tracking-title">
          {c("question")}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-2.5 pt-4 pb-3 md:gap-4 md:pt-5 md:pr-4 md:pb-5 md:pl-3 xl:pl-0">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-2.5">
          <Badge variant="success">{c("live")}</Badge>
          <p className="text-sm text-muted-foreground">{c("kind")}</p>
        </div>
        <h4 className="text-2xl font-semibold md:text-3xl md:tracking-title">{c("name")}</h4>
        <p className="text-base font-medium text-primary md:text-lg md:font-normal">
          <CampaignCountdown deadline={liveCampaignDeadline} />
        </p>
        <dl
          aria-label={c("facts.label")}
          className="flex flex-col gap-2.5 border-y py-3.5 md:flex-row md:gap-6 md:py-5"
        >
          {facts.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2 md:flex-1 md:flex-col md:items-start md:gap-1"
            >
              <dt className="flex flex-1 items-center gap-2 text-xs font-medium text-muted-foreground md:flex-none md:flex-col md:items-start md:gap-1">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                {label}
              </dt>
              <dd className="text-sm font-semibold md:text-lg">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <Button size="lg" href={liveCampaignUrl}>
            {c("applyNow")}
          </Button>
          <Button size="lg" prominence="secondary" href={liveCampaignUrl}>
            {c("readBrief")}
          </Button>
        </div>
      </div>
    </article>
  );
}

/** A recurring event is one card with a date tile per upcoming session (DESIGN.md › Cards). */
function NextMeetup({ meetup }: { meetup: NonNullable<EventsData["meetup"]> }) {
  const t = useTranslations("Home.events");
  const format = useFormatter();

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card py-3.5 pr-4.5 pl-3.5 text-card-foreground shadow-card md:flex-row md:items-center md:justify-between md:gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-semibold">{meetup.name}</h4>
        {meetup.recurring && <p className="text-xs text-muted-foreground">{t("meetupSchedule")}</p>}
      </div>
      <ul aria-label={t("meetupDates")} className="flex gap-2">
        {meetup.dates.map((iso) => {
          const date = new Date(iso);
          return (
            <li key={iso}>
              <time
                dateTime={iso}
                className="flex h-14 w-13 flex-col items-center justify-center rounded-lg border bg-muted"
              >
                <span className="text-xs font-semibold text-primary uppercase">
                  {t("tileMonth", { date })}
                </span>
                <span className="text-lg font-semibold">
                  {format.dateTime(date, { day: "numeric" })}
                </span>
              </time>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** "23 Sep – 5 Dec 2026", or one day, in Vietnam time. */
function daysOf(format: ReturnType<typeof useFormatter>, startsOn: string, endsOn: string) {
  const options = { day: "numeric", month: "short", year: "numeric" } as const;
  const start = new Date(`${startsOn}T00:00:00+07:00`);
  return startsOn === endsOn
    ? format.dateTime(start, options)
    : format.dateTimeRange(start, new Date(`${endsOn}T00:00:00+07:00`), options);
}

/** Past programs as cover cards; on phones they stack instead of scrolling sideways. */
function PastPrograms({ programs }: { programs: PastProgram[] }) {
  const kinds = useTranslations("Program.type") as unknown as (code: string) => string;
  const format = useFormatter();

  return (
    <ul className="grid gap-3 md:gap-4 lg:grid-cols-3">
      {programs.map((program) => (
        <li
          key={program.slug}
          className="flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-card"
        >
          {program.coverUrl ? (
            <Image
              src={program.coverUrl}
              alt=""
              width={1200}
              height={450}
              unoptimized
              className="h-30 w-full object-cover md:h-37.5"
            />
          ) : (
            <div className="h-30 w-full bg-linear-155 from-primary to-brand md:h-37.5" />
          )}
          <div className="flex flex-col gap-1 px-4.5 pt-4 pb-4.5">
            <p className="text-xs font-medium text-muted-foreground">
              {program.partnerName
                ? `${kinds(program.type)} · ${program.partnerName}`
                : kinds(program.type)}
            </p>
            <h4 className="text-base font-medium">{program.name}</h4>
            {program.startsOn && program.endsOn && (
              <p className="text-xs font-medium text-primary">
                {daysOf(format, program.startsOn, program.endsOn)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export { ProgramsEvents };
