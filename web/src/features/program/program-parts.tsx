import { CheckIcon, EyeOffIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Link } from "@/i18n/navigation";
import type { Program } from "@/lib/api/generated";
import { adminProgramRoute, programApplyUrl } from "@/lib/site";

import { ProgramCountdown } from "./program-countdown";
import { deadlineText, placeOf, vietnamDay, whenText } from "./program-format";

type Format = Awaited<ReturnType<typeof getFormatter>>;

/** One step of a program's timeline, from its key dates or its application window. */
type Step = { title: string; when: string; at: string; note?: string | null };

/**
 * The steps of a program in order: its key dates, and the opening, the closing and the day outcomes
 * are due, named in the visitor's language.
 */
export async function timelineOf(program: Program, format: Format): Promise<Step[]> {
  const t = await getTranslations("Program.timeline");
  const steps: Step[] = program.keyDates.map((keyDate) => ({
    title: keyDate.title,
    when: whenText(format, keyDate),
    at: keyDate.startsAt,
    note: keyDate.note,
  }));
  const applications = program.applications;
  if (applications) {
    steps.push(
      {
        title: t("opens"),
        when: whenText(format, { startsAt: applications.opensAt }),
        at: applications.opensAt,
      },
      { title: t("closes"), when: deadlineText(format, applications), at: applications.closesAt },
    );
    if (applications.outcomesDueOn) {
      const due = vietnamDay(applications.outcomesDueOn).toISOString();
      steps.push({
        title: t("outcomes"),
        when: whenText(format, { startsAt: due, allDay: true }),
        at: due,
      });
    }
  }
  return steps.sort((a, b) => a.at.localeCompare(b.at));
}

/** The steps as a numbered rail; a step whose moment has passed is ticked. */
export function Timeline({ steps, now }: { steps: Step[]; now: number }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const past = Date.parse(step.at) < now;
        const last = index === steps.length - 1;
        return (
          <li key={`${step.at}-${step.title}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-0 left-3.25 w-0.5 bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className={
                past
                  ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold text-primary"
              }
            >
              {past ? <CheckIcon className="size-4" /> : index + 1}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">
                {[step.when, step.note].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The card beside a program's page while it takes applications: the deadline, Apply, and the next
 * steps. The day count is the browser's; the server states only the deadline.
 */
export async function ApplyCard({
  program,
  steps,
  now,
}: {
  program: Program;
  steps: Step[];
  now: number;
}) {
  const [t, format] = await Promise.all([getTranslations("Program.page"), getFormatter()]);
  const applications = program.applications;
  const apply = programApplyUrl(program.slug);
  const open = program.phase === "open" && applications;
  const next = steps.filter((step) => Date.parse(step.at) >= now).slice(0, 5);

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card">
      {open ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t("closesIn")}</p>
          <p className="text-lg font-semibold text-primary">
            <ProgramCountdown
              deadline={applications.closesAt}
              closes={deadlineText(format, applications)}
            />
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium">{t(`phase.${program.phase}`)}</p>
      )}
      {open && apply && (
        <Button href={apply} size="lg">
          {t("applyNow")}
        </Button>
      )}
      {next.length > 0 && (
        <dl className="flex flex-col divide-y border-t">
          {next.map((step) => (
            <div
              key={`${step.at}-${step.title}`}
              className="flex justify-between gap-4 py-2.5 text-sm"
            >
              <dt className="text-muted-foreground">{step.title}</dt>
              <dd className="shrink-0 text-right font-medium">{step.when}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

/** A program's events, each with when, where and where to register. */
export async function EventList({ program }: { program: Program }) {
  const [t, format] = await Promise.all([getTranslations("Program.page"), getFormatter()]);
  return (
    <ul className="flex flex-col gap-3">
      {program.events.map((event) => (
        <li
          key={`${event.startsAt}-${event.title}`}
          className="flex flex-col gap-3 rounded-xl border bg-card px-4.5 py-3.5 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{event.title}</p>
            <p className="text-xs text-muted-foreground">
              {[whenText(format, event), placeOf(event, t("online"))].filter(Boolean).join(" · ")}
            </p>
          </div>
          {event.registrationUrl && (
            <Button size="sm" prominence="secondary" href={event.registrationUrl}>
              {t("register")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Says, above a draft's page, that only operators see it, and leads back to its Settings. */
export async function DraftBanner({ program }: { program: Program }) {
  const t = await getTranslations("Program.page.draft");
  if (program.status !== "draft") {
    return null;
  }
  return (
    <div role="status" className="border-b bg-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-2.5 text-sm md:flex-row md:items-center md:gap-3 md:px-8">
        <span className="flex items-center gap-2">
          <EyeOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {t("message")}
        </span>
        <Link
          href={adminProgramRoute(program.id)}
          className="font-medium text-primary hover:underline md:ml-auto"
        >
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
