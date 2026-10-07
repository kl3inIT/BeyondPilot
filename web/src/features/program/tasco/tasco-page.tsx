import {
  CarIcon,
  CheckIcon,
  CircleHelpIcon,
  CopyIcon,
  FileTextIcon,
  PhoneIcon,
  ReceiptTextIcon,
  ShieldBanIcon,
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
import type { Program } from "@/lib/api/generated";
import { genaiFundLinks, liveCampaignUrl, programApplyUrl } from "@/lib/site";

import { ProgramCountdown } from "../program-countdown";
import { deadlineText, programFormatter, renderedAt } from "../program-format";
import { ProgramBreadcrumb } from "../program-page";
import { ApplyCard, DraftBanner, Timeline, timelineOf } from "../program-parts";

const pains = [
  ["paper", FileTextIcon],
  ["must", ReceiptTextIcon],
  ["unaware", CircleHelpIcon],
  ["carry", CarIcon],
  ["same", CopyIcon],
  ["claim", PhoneIcon],
] as const;

const kinds = [
  "solo",
  "students",
  "early",
  "late",
  "unicorn",
  "isv",
  "si",
  "enterprise",
  "agency",
] as const;

const wins = ["yes", "partner", "investment"] as const;

const directionGroups = [
  ["buying", ["d1", "d2", "d3"]],
  ["carrying", ["d4", "d5", "d6"]],
  ["claiming", ["d7", "d8", "other"]],
] as const;

const submitItems = ["framing", "prototype", "impact", "needs", "responsible"] as const;

const criteria = [
  "impact",
  "execution",
  "scale",
  "compliance",
  "feasibility",
  "experience",
  "sustainability",
  "clarity",
] as const;

/** The judges as the live campaign page lists them; their photos are recorded in docs/research/data/landing-image-sources.json. */
const judges = [
  ["laura", "Laura Nguyen", "laura-nguyen.jpg", "https://www.linkedin.com/in/lauranguyent/"],
  ["kai", "Kai Yong", "kai-yong.jpg", "https://www.linkedin.com/in/kaiyongkang/"],
  [
    "rizwan",
    "Rizwan Hazarika",
    "rizwan-hazarika.jpg",
    "https://www.linkedin.com/in/rizwan-hazarika-985912/",
  ],
  ["david", "David Low", "david-low.jpg", "https://www.linkedin.com/in/davidlowjw/"],
  ["julie", "Julie Bulaklak", "julie-bulaklak.jpg", "https://www.linkedin.com/in/julieb88/"],
  ["hawkins", "Hawkins Pham", "hawkins-pham.jpg", "https://www.linkedin.com/in/hawkinspham/"],
  [
    "manuja",
    "Don Manuja Kasthuriarachchi",
    "manuja-kasthuriarachchi.jpg",
    "https://www.linkedin.com/in/manujakasthuriarachchi/",
  ],
] as const;

const faqs = ["startup", "inMarket", "ip", "vietnam", "hearBack"] as const;

const sections = [
  "challenge",
  "who",
  "win",
  "directions",
  "timeline",
  "submit",
  "judges",
  "faq",
] as const;

function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-title md:text-3xl">{title}</h2>
      {lead && <p className="max-w-3xl text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** The card to apply, the brief and the note under it. */
async function ApplyRail({
  program,
  steps,
  now,
}: {
  program: Program;
  steps: Awaited<ReturnType<typeof timelineOf>>;
  now: number;
}) {
  const t = await getTranslations("Tasco");
  return (
    <>
      <ApplyCard program={program} steps={steps} now={now} />
      <Button prominence="secondary" href={liveCampaignUrl}>
        {t("rail.readBrief")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("rail.note")}</p>
    </>
  );
}

/**
 * The page written for the AI for Insurance Challenge × Tasco. Its long content is fixed for the
 * campaign and lives in both catalogs; its dates, events and application window are the program's.
 */
async function TascoPage({ program }: { program: Program }) {
  const [t, page, locale] = await Promise.all([
    getTranslations("Tasco"),
    getTranslations("Program.page"),
    getLocale(),
  ]);
  const format = programFormatter(locale);
  const now = renderedAt();
  const steps = await timelineOf(program, format);
  const applications = program.applications;
  const apply = programApplyUrl(program.slug);
  const open = program.phase === "open" && applications;

  return (
    <div lang={locale}>
      <DraftBanner program={program} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 pb-16 md:px-8">
        <ProgramBreadcrumb name={program.name} />

        <header className="flex flex-col gap-8 overflow-hidden rounded-3xl bg-primary bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-6 text-primary-foreground md:p-10 dark:from-transparent">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant={open ? "success" : "info"}>{page(`phase.${program.phase}`)}</Badge>
                <span className="text-sm text-primary-foreground">{t("kind")}</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-headline md:text-5xl">
                {program.name}
              </h1>
              {program.summary && (
                <p className="max-w-2xl text-lg text-primary-foreground">{program.summary}</p>
              )}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                {open && apply && (
                  <Button size="lg" prominence="secondary" href={apply}>
                    {page("applyNow")}
                  </Button>
                )}
                {open && (
                  <p className="text-sm text-primary-foreground">
                    <ProgramCountdown
                      deadline={applications.closesAt}
                      closes={deadlineText(format, applications)}
                    />
                  </p>
                )}
              </div>
            </div>
            <figure className="flex flex-col gap-3 rounded-2xl bg-card p-6 text-card-foreground lg:w-110">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {t("question.label")}
              </p>
              <blockquote className="text-xl font-semibold md:text-2xl">
                {t("question.text")}
              </blockquote>
              <figcaption className="text-xs text-muted-foreground">
                {t("question.setBy")}
              </figcaption>
            </figure>
          </div>
          <ul className="grid gap-5 border-t border-primary-foreground/25 pt-6 md:grid-cols-3">
            {(["teams", "investment", "pilot"] as const).map((stat) => (
              <li key={stat} className="flex flex-col gap-1">
                <p className="text-2xl font-semibold">{t(`stats.${stat}.value`)}</p>
                <p className="text-sm text-primary-foreground">{t(`stats.${stat}.label`)}</p>
              </li>
            ))}
          </ul>
        </header>

        <nav aria-label={t("nav.label")} className="overflow-x-auto border-b">
          <ul className="flex gap-6 text-sm whitespace-nowrap">
            {sections.map((section) => (
              <li key={section}>
                <a
                  href={`#${section}`}
                  className="inline-flex min-h-11 items-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline"
                >
                  {t(`nav.${section}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* On a phone the card to apply comes first; from lg it stands beside the content. */}
        <div className="flex flex-col gap-4 lg:hidden">
          <ApplyRail program={program} steps={steps} now={now} />
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-14">
            <section id="challenge" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("challenge.title")} lead={t("challenge.lead")} />
              <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                {pains.map(([pain, Icon]) => (
                  <li key={pain} className="flex gap-3">
                    <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium">{t(`challenge.pains.${pain}.title`)}</p>
                      <p className="text-sm text-muted-foreground">
                        {t(`challenge.pains.${pain}.text`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 rounded-xl border bg-accent p-4">
                <ShieldBanIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">{t("challenge.constraint.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("challenge.constraint.text")}</p>
                </div>
              </div>
            </section>

            <section id="who" className="flex scroll-mt-6 flex-col gap-5">
              <SectionHead title={t("who.title")} lead={t("who.lead")} />
              <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 md:grid-cols-3">
                {kinds.map((kind) => (
                  <li key={kind} className="flex items-center gap-2 text-sm">
                    <CheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {t(`who.kinds.${kind}`)}
                  </li>
                ))}
              </ul>
            </section>

            <section id="win" className="flex scroll-mt-6 flex-col gap-5">
              <SectionHead title={t("win.title")} lead={t("win.lead")} />
              <ul className="grid gap-6 md:grid-cols-3">
                {wins.map((win) => (
                  <li key={win} className="flex flex-col gap-2 border-t-2 border-primary pt-4">
                    <p className="font-medium">{t(`win.cards.${win}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`win.cards.${win}.text`)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section id="directions" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("directions.title")} lead={t("directions.lead")} />
              {directionGroups.map(([group, items]) => (
                <div key={group} className="flex flex-col gap-3">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">{t(`directions.groups.${group}.label`)}</span>
                    <span className="text-muted-foreground">
                      {t(`directions.groups.${group}.lead`)}
                    </span>
                  </p>
                  <ul className="grid gap-3 md:grid-cols-3">
                    {items.map((item) => (
                      <li
                        key={item}
                        className={
                          item === "other"
                            ? "flex flex-col gap-1.5 rounded-xl border border-dashed bg-muted p-4"
                            : "flex flex-col gap-1.5 rounded-xl border bg-card p-4"
                        }
                      >
                        <span className="text-xs font-semibold text-primary tabular-nums">
                          {item === "other" ? "+" : item.slice(1).padStart(2, "0")}
                        </span>
                        <p className="font-medium">{t(`directions.items.${item}.title`)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(`directions.items.${item}.text`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            <section id="timeline" className="flex scroll-mt-6 flex-col gap-5">
              <SectionHead title={t("timeline.title")} lead={t("timeline.lead")} />
              <Timeline steps={steps} now={now} />
            </section>

            <section id="submit" className="flex scroll-mt-6 flex-col gap-6">
              <SectionHead title={t("submit.title")} lead={t("submit.lead")} />
              <ol className="flex flex-col gap-4">
                {submitItems.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium">{t(`submit.items.${item}.title`)}</p>
                      <p className="text-sm text-muted-foreground">
                        {t(`submit.items.${item}.text`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold">{t("submit.judgedOn")}</h3>
                <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {criteria.map((criterion) => (
                    <li key={criterion} className="flex items-center gap-2 text-sm">
                      <CheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
                      {t(`submit.criteria.${criterion}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="judges" className="flex scroll-mt-6 flex-col gap-5">
              <SectionHead title={t("judges.title")} />
              <ul className="grid gap-3 sm:grid-cols-2">
                {judges.map(([id, name, photo, linkedin]) => (
                  <li
                    key={id}
                    className="relative flex items-center gap-3 rounded-xl border bg-card p-3"
                  >
                    <Image
                      src={`/programs/tasco/judges/${photo}`}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-full object-cover"
                    />
                    <div className="flex min-w-0 flex-col">
                      <a
                        href={linkedin}
                        aria-label={t("judges.linkedin", { name })}
                        className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {name}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {t(`judges.roles.${id}`)}
                      </span>
                    </div>
                  </li>
                ))}
                <li className="flex items-center justify-center rounded-xl border border-dashed bg-muted p-3 text-sm text-muted-foreground">
                  {t("judges.more")}
                </li>
              </ul>
            </section>

            <section id="faq" className="flex scroll-mt-6 flex-col gap-4">
              <SectionHead title={t("faq.title")} />
              <Accordion defaultValue={["startup"]}>
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
              <ApplyRail program={program} steps={steps} now={now} />
            </div>
            <aside
              aria-label={t("rail.partners")}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rail.host")}</p>
                <Image
                  src="/programs/tasco/tasco.png"
                  alt="Tasco"
                  width={1238}
                  height={178}
                  className="h-6 w-auto self-start"
                />
                <p className="text-xs text-muted-foreground">{t("rail.hostText")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("rail.tech")}</p>
                <div className="flex items-center gap-4">
                  <Image
                    src="/programs/tasco/microsoft-for-startups.png"
                    alt="Microsoft for Startups"
                    width={78}
                    height={32}
                    className="h-8 w-auto"
                  />
                  <Image
                    src="/programs/tasco/notion.png"
                    alt="Notion"
                    width={66}
                    height={24}
                    className="h-6 w-auto"
                  />
                </div>
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

        {open && apply && (
          <section className="flex flex-col gap-4 rounded-3xl bg-primary bg-linear-150 from-foreground/60 via-transparent via-60% to-transparent p-6 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-10 dark:from-transparent">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold md:text-3xl">{t("closing.title")}</h2>
              <p className="text-primary-foreground">{t("closing.text")}</p>
            </div>
            <Button size="lg" prominence="secondary" href={apply}>
              {page("applyNow")}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

export { TascoPage };
