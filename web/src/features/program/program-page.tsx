import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import type { Program } from "@/lib/api/generated";
import { programApplyUrl, siteRoutes } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

import { ProgramCountdown } from "./program-countdown";
import { daysText, deadlineText, renderedAt } from "./program-format";
import { ApplyCard, DraftBanner, EventList, Timeline, timelineOf } from "./program-parts";

/** The badge of a program's phase: open is the one that takes action. */
const phaseVariant = {
  open: "success",
  upcoming: "info",
  running: "info",
  done: "outline",
} as const;

/** Where a visitor is: the programs, then this one. */
export async function ProgramBreadcrumb({ name }: { name: string }) {
  const t = await getTranslations("Program.page");
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={siteRoutes.programs} />}>
            {t("programs")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * A program's standard page, built from what an operator entered: the summary and the cover, About,
 * the timeline of its key dates and application window, its events, and the card to apply.
 */
async function ProgramPage({ program }: { program: Program }) {
  const [t, types, format, locale] = await Promise.all([
    getTranslations("Program.page"),
    getTranslations("Program.type"),
    getFormatter(),
    getLocale(),
  ]);
  const now = renderedAt();
  const steps = await timelineOf(program, format);
  const applications = program.applications;
  const apply = programApplyUrl(program.slug);
  const open = program.phase === "open" && applications;
  const kind = [types(program.type), program.partnerName].filter(Boolean).join(" · ");

  return (
    <div lang={locale}>
      <DraftBanner program={program} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
        <ProgramBreadcrumb name={program.name} />

        <header className="flex flex-col gap-6 overflow-hidden rounded-3xl bg-primary bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-6 text-primary-foreground md:p-10 lg:flex-row lg:items-center dark:from-transparent">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={phaseVariant[program.phase]}>{t(`phase.${program.phase}`)}</Badge>
              <span className="text-sm text-primary-foreground/80">{kind}</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">{program.name}</h1>
            {program.summary && (
              <p className="max-w-2xl text-lg text-primary-foreground/90">{program.summary}</p>
            )}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              {open && apply && (
                <Button size="lg" prominence="secondary" href={apply}>
                  {t("applyNow")}
                </Button>
              )}
              <p className="text-sm text-primary-foreground/90">
                {open ? (
                  <ProgramCountdown
                    deadline={applications.closesAt}
                    closes={deadlineText(format, applications)}
                  />
                ) : (
                  program.startsOn &&
                  program.endsOn &&
                  daysText(format, program.startsOn, program.endsOn)
                )}
              </p>
            </div>
          </div>
          {program.coverFileId && (
            <Image
              src={publicFileUrl(program.coverFileId)}
              alt=""
              width={560}
              height={320}
              unoptimized
              priority
              className="aspect-video w-full rounded-2xl object-cover lg:w-120"
            />
          )}
        </header>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-10">
            {program.about && (
              <section className="flex flex-col gap-3">
                <h2 className="text-2xl font-semibold tracking-title">{t("about")}</h2>
                <p className="max-w-3xl whitespace-pre-line text-muted-foreground">
                  {program.about}
                </p>
              </section>
            )}
            {steps.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold tracking-title">{t("timeline")}</h2>
                <Timeline steps={steps} now={now} />
              </section>
            )}
            {program.events.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold tracking-title">{t("events")}</h2>
                <EventList program={program} />
              </section>
            )}
            {!program.about && steps.length === 0 && program.events.length === 0 && (
              <p className="text-muted-foreground">{t("nothingYet")}</p>
            )}
          </div>
          <div className="lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
            <ApplyCard program={program} steps={steps} now={now} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { ProgramPage };
