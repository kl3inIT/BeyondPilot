import {
  ArrowDownIcon,
  CalendarClockIcon,
  FileTextIcon,
  HandshakeIcon,
  MapPinIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { readProgramUseCases } from "@/features/usecase/use-cases-queries";
import type { Program } from "@/lib/api/generated";
import { genaiFundLinks, programApplyRoute } from "@/lib/site";

import { ProgramCountdown } from "../program-countdown";
import { deadlineText, programFormatter, renderedAt } from "../program-format";
import { ProgramBreadcrumb } from "../program-page";
import {
  ApplyCard,
  DraftBanner,
  EventList,
  SectionHead,
  Timeline,
  timelineOf,
} from "../program-parts";
import { ProgramUseCases } from "../program-use-cases";
import { ChallengeAreas, Eligibility, SupportingActivities } from "./nestle-parts";

const facts = [
  ["closes", CalendarClockIcon],
  ["matchingDay", MapPinIcon],
  ["opportunity", SearchIcon],
  ["who", UsersIcon],
] as const;

const offers = [
  ["owners", UsersIcon],
  ["needs", FileTextIcon],
  ["collaboration", HandshakeIcon],
] as const;

const stages = ["apply", "briefings", "matching", "collaboration"] as const;

const faqs = ["who", "finished", "after", "prize", "vietnam", "early", "ip", "hearBack"] as const;

const sections = ["offers", "areas", "use-cases", "how", "eligibility", "dates", "faq"] as const;

/** The site of the programme this search belongs to, as the campaign names it. */
const programmeSite = "innovation.genaifund.ai";

/**
 * The page written for Nestlé Vietnam AI Reinvention, carried over from the campaign's own page.
 * Its content is fixed for the campaign and lives in both catalogs; its dates, events and
 * application window are the program's.
 */
async function NestlePage({ program, askHref }: { program: Program; askHref?: string }) {
  const [t, page, locale, useCases] = await Promise.all([
    getTranslations("Nestle"),
    getTranslations("Program.page"),
    getLocale(),
    readProgramUseCases(program.slug),
  ]);
  const format = programFormatter(locale);
  const now = renderedAt();
  const steps = await timelineOf(program, format);
  const applications = program.applications;
  const apply = programApplyRoute(program.slug);
  const open = program.phase === "open" && applications;
  const closes = applications ? deadlineText(format, applications) : null;

  return (
    <div id="top" lang={locale}>
      <DraftBanner program={program} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
        <ProgramBreadcrumb name={program.name} />

        <div className="flex flex-col gap-6">
          <header className="flex flex-col overflow-hidden rounded-3xl border">
            {/* The photograph GenAI Fund chose fills the right of the band from edge to edge; the site's blue runs
                into it from the left, so the words keep their contrast and nothing frames the picture. A phone
                has no room for both, and keeps the blue. */}
            <div className="relative isolate flex flex-col gap-8 overflow-hidden bg-primary p-6 text-primary-foreground md:p-10 lg:min-h-104 lg:justify-center">
              <div
                aria-hidden="true"
                className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 lg:block"
              >
                <Image
                  src="/programs/nestle/hero-photo.webp"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1280px) 40rem, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-r from-primary via-primary/40 via-25% to-transparent to-55%" />
              </div>
              <div className="flex min-w-0 flex-col gap-4 lg:max-w-xl">
                <div className="flex">
                  <Badge variant={open ? "success" : "info"}>
                    {page(`phase.${program.phase}`)}
                  </Badge>
                </div>
                <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">
                  {program.name}
                </h1>
                <p className="max-w-xl text-xl font-semibold">{t("hero.tagline")}</p>
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                  {open && (
                    <Button size="lg" prominence="secondary" href={apply}>
                      {page("applyNow")}
                    </Button>
                  )}
                  <Button size="lg" prominence="inverse" href="#areas">
                    {t("hero.explore")}
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                </div>
                {open && (
                  <p className="text-sm">
                    <ProgramCountdown
                      deadline={applications.closesAt}
                      closes={deadlineText(format, applications)}
                    />
                  </p>
                )}
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-5 bg-accent p-6 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
              {facts.map(([fact, Icon]) => (
                // A group of a description list holds only its term and description, so the icon
                // stands inside the term.
                <div key={fact} className="flex flex-col gap-1.5">
                  <dt className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {t(`hero.facts.${fact}.label`)}
                  </dt>
                  <dd className="font-semibold">
                    {fact === "closes" && closes ? closes : t(`hero.facts.${fact}.value`)}
                  </dd>
                </div>
              ))}
            </dl>
          </header>
          <div className="grid gap-4 md:grid-cols-5 md:gap-10">
            <p className="text-lg text-muted-foreground md:col-span-3">{t("hero.lead")}</p>
            <p className="self-start border-l-2 border-primary pl-3 text-sm font-medium md:col-span-2">
              {t("hero.open")}
            </p>
          </div>
        </div>

        <nav aria-label={t("nav.label")} className="border-b">
          <ul className="flex flex-wrap gap-x-6 text-sm">
            {sections
              .filter((section) => section !== "use-cases" || useCases.items.length > 0)
              .map((section) => (
                <li key={section}>
                  <a
                    href={`#${section}`}
                    className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {t(`nav.${section}`)}
                  </a>
                </li>
              ))}
          </ul>
        </nav>

        {/* On a phone the card to apply comes first; from lg it stands beside the content. */}
        <div className="flex flex-col gap-4 lg:hidden">
          <ApplyCard program={program} steps={steps} now={now} askHref={askHref} />
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-14">
            <section id="offers" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("offers.title")} lead={t("offers.lead")} />
              <ul className="grid gap-4 md:grid-cols-3">
                {offers.map(([offer, Icon]) => (
                  <li key={offer} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-semibold">{t(`offers.items.${offer}.title`)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t(`offers.items.${offer}.text`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section id="areas" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("areas.title")} lead={t("areas.lead")} />
              <ChallengeAreas />
              <div className="flex flex-col gap-4 rounded-xl border border-dashed bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm">
                  <strong className="font-semibold">{t("early.ask")}</strong> {t("early.text")}
                </p>
                {open && <Button href={apply}>{page("applyNow")}</Button>}
              </div>
            </section>

            {useCases.items.length > 0 && (
              <ProgramUseCases
                useCases={useCases}
                title={t("useCases.title")}
                lead={t("useCases.lead")}
              />
            )}

            <section id="how" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("how.title")} lead={t("how.lead")} />
              <ol className="grid gap-4 md:grid-cols-2">
                {stages.map((stage, index) => (
                  <li key={stage} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                    <span
                      aria-hidden="true"
                      className="text-2xl font-semibold text-primary tabular-nums"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-semibold">{t(`how.steps.${stage}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`how.steps.${stage}.text`)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <Eligibility />

            <section id="dates" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("dates.title")} />
              <Timeline steps={steps} now={now} />
              {program.events.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-semibold">{page("events")}</h3>
                  <EventList program={program} />
                </div>
              )}
              <SupportingActivities />
            </section>

            <section id="faq" className="flex scroll-mt-6 flex-col gap-4">
              <SectionHead title={t("faq.title")} />
              <Accordion defaultValue={["who"]}>
                {faqs.map((id) => (
                  <AccordionItem key={id} value={id}>
                    <AccordionTrigger>{t(`faq.items.${id}.q`)}</AccordionTrigger>
                    <AccordionContent>{t(`faq.items.${id}.a`)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
            <div className="hidden flex-col gap-4 lg:flex">
              <ApplyCard program={program} steps={steps} now={now} askHref={askHref} />
            </div>
            <aside
              aria-label={t("rail.partners")}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rail.runBy")}</p>
                <Image
                  src="/brand/genaifund-logo.png"
                  alt="GenAI Fund"
                  width={1200}
                  height={252}
                  className="h-6 w-auto self-start dark:hidden"
                />
                <Image
                  src="/brand/genaifund-logo-white.png"
                  alt="GenAI Fund"
                  width={1200}
                  height={252}
                  className="hidden h-6 w-auto self-start dark:block"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rail.with")}</p>
                <Image
                  src="/programs/nestle/nestle.png"
                  alt="Nestlé"
                  width={290}
                  height={300}
                  className="h-16 w-auto self-start"
                />
              </div>
              <div className="flex flex-col gap-0.5 border-t pt-3 text-xs">
                <p className="text-muted-foreground">{t("rail.questions")}</p>
                <a
                  href={`mailto:${genaiFundLinks.email}`}
                  className="font-medium text-primary hover:underline"
                >
                  {genaiFundLinks.email}
                </a>
              </div>
            </aside>
          </div>
        </div>

        {open && closes && (
          <section className="flex flex-col gap-8 rounded-3xl border bg-card p-6 md:flex-row md:items-center md:gap-12 md:p-10">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <h2 className="text-2xl font-semibold tracking-title md:text-4xl">
                {t("closing.title")} <span className="text-primary">{t("closing.text")}</span>
              </h2>
              <p className="text-sm text-muted-foreground">{t("closing.closes", { closes })}</p>
              <div className="flex">
                <Button size="lg" href={apply}>
                  {page("applyNow")}
                </Button>
              </div>
            </div>
            <Image
              src="/programs/nestle/key-visual.webp"
              alt=""
              width={1100}
              height={900}
              sizes="(min-width: 768px) 22rem, 100vw"
              className="hidden h-auto rounded-2xl md:block md:w-88"
            />
          </section>
        )}

        <section aria-label={t("about.label")} className="flex flex-col gap-3 border-t pt-8">
          <Image
            src="/programs/nestle/ai-hackathon-2026.png"
            alt="AI Hackathon 2026"
            width={700}
            height={146}
            className="h-8 w-auto self-start"
          />
          <p className="text-sm font-semibold">{t("about.tagline")}</p>
          <p className="max-w-3xl text-xs text-muted-foreground">{t("about.text")}</p>
          <a
            href={`https://${programmeSite}`}
            className="self-start text-xs font-medium text-primary hover:underline"
          >
            {programmeSite}
          </a>
        </section>
      </div>
    </div>
  );
}

export { NestlePage };
