import { FileTextIcon, HandshakeIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Program } from "@/lib/api/generated";
import { programApplyRoute } from "@/lib/site";

import { deadlineText, programFormatter } from "../program-format";
import { DraftBanner, EventList, timelineOf } from "../program-parts";
import { NestleMenu } from "./nestle-menu";
import {
  ChallengeAreas,
  Eligibility,
  Faq,
  NestleTimeline,
  SupportingActivities,
} from "./nestle-parts";
import s from "./nestle.module.css";

const facts = [
  ["closes", "▦"],
  ["matchingDay", "⌖"],
  ["opportunity", "⚲"],
  ["who", "⚇"],
] as const;

const offers = [
  ["owners", UsersIcon],
  ["needs", FileTextIcon],
  ["collaboration", HandshakeIcon],
] as const;

const stages = ["apply", "briefings", "matching", "collaboration"] as const;

const sections = ["offers", "areas", "how", "eligibility", "dates", "faq"] as const;

/**
 * The page written for Nestlé Vietnam AI Reinvention, drawn as the client drew it (nestle.module.css).
 * Its content is fixed for the campaign and lives in both catalogs; its dates, events and application
 * window are the program's, and every way in to apply is the program's own.
 */
async function NestlePage({ program }: { program: Program }) {
  const [t, page, locale] = await Promise.all([
    getTranslations("Nestle"),
    getTranslations("Program.page"),
    getLocale(),
  ]);
  const format = programFormatter(locale);
  const steps = await timelineOf(program, format);
  const applications = program.applications;
  const apply = programApplyRoute(program.slug);
  const open = program.phase === "open" && applications;
  const day = (at: string) => format.dateTime(new Date(at), "day");

  return (
    <div id="top" lang={locale} className={s.root}>
      <DraftBanner program={program} />

      <section className={s.hero}>
        <div className={s.container}>
          <div className={s.logos}>
            <Image
              src="/programs/nestle/nestle.png"
              alt="Nestlé"
              width={290}
              height={300}
              className={s.logoNestle}
            />
            <span aria-hidden="true" className={s.logoRule} />
            <Image
              src="/brand/genaifund-logo.png"
              alt="GenAI Fund"
              width={1200}
              height={252}
              className={s.logoGenai}
            />
            <span aria-hidden="true" className={s.logoRule} />
            <Image
              src="/programs/nestle/ai-hackathon-2026.png"
              alt="AI Hackathon 2026"
              width={700}
              height={146}
              className={s.logoHackathon}
            />
          </div>
          <div className={s.heroGrid}>
            <div>
              <h1 className={s.title}>
                {t("hero.name.first")}{" "}
                <span className={s.gradientText}>{t("hero.name.second")}</span>
              </h1>
              <p className={s.tagline}>{t("hero.tagline")}</p>
              <div className={s.actions}>
                {open && (
                  <Link href={apply} className={s.button}>
                    {page("applyNow")} <span aria-hidden="true">→</span>
                  </Link>
                )}
                <a href="#areas" className={s.buttonOutline}>
                  {t("hero.explore")} <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
            <Image
              src="/programs/nestle/key-visual-wide.webp"
              alt=""
              width={1920}
              height={1080}
              priority
              sizes="(min-width: 1280px) 34rem, (min-width: 1024px) 45vw, 100vw"
              className={s.heroVisual}
            />
          </div>
          <div className={s.leadRow}>
            <p className={s.lead}>{t("hero.lead")}</p>
            <p className={s.note}>{t("hero.open")}</p>
          </div>
        </div>
        <div className={s.facts}>
          <dl className={s.factsInner}>
            {facts.map(([fact, glyph]) => (
              <div key={fact} className={s.fact}>
                <dt className={s.factLabel}>
                  <span aria-hidden="true" className={s.factGlyph}>
                    {glyph}
                  </span>
                  <span>{t(`hero.facts.${fact}.label`)}</span>
                </dt>
                <dd className={s.factValue}>
                  {fact === "closes" && applications
                    ? deadlineText(format, applications)
                    : t(`hero.facts.${fact}.value`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="offers" className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t("offers.title")}</h2>
          <p className={s.sectionLead}>{t("offers.lead")}</p>
          <ul className={s.offerCards}>
            {offers.map(([offer, Icon]) => (
              <li key={offer} className={s.card}>
                <span className={s.offerIcon}>
                  <Icon size={21} aria-hidden="true" />
                </span>
                <h3 className={s.h3}>{t(`offers.items.${offer}.title`)}</h3>
                <p className={s.cardText}>{t(`offers.items.${offer}.text`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="areas" className={s.sectionTint}>
        <div className={s.container}>
          <h2 className={s.h2}>{t("areas.title")}</h2>
          <p className={s.sectionLead}>{t("areas.lead")}</p>
          <div className={s.sectionBody}>
            <ChallengeAreas />
            <div className={s.early}>
              <p className={s.earlyText}>
                <strong>{t("early.ask")}</strong> {t("early.text")}
              </p>
              {open && (
                <Link href={apply} className={s.button}>
                  {page("applyNow")} <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t("how.title")}</h2>
          <p className={s.sectionLead}>{t("how.lead")}</p>
          <ol className={s.howCards}>
            {stages.map((stage, index) => (
              <li key={stage} className={s.card}>
                <span aria-hidden="true" className={s.stepNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className={s.h3}>{t(`how.steps.${stage}.title`)}</h3>
                <p className={s.cardText}>{t(`how.steps.${stage}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Eligibility />

      <section id="dates" className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t("dates.title")}</h2>
          <NestleTimeline steps={steps} closesAt={applications?.closesAt ?? null} format={format} />
          {program.events.length > 0 && (
            <>
              <h3 className={s.eventsTitle}>{page("events")}</h3>
              <EventList program={program} />
            </>
          )}
          <SupportingActivities />
        </div>
      </section>

      <section id="faq" className={s.section}>
        <div className={s.container}>
          <h2 className={s.h2}>{t("faq.title")}</h2>
          <Faq />
        </div>
      </section>

      {open && (
        <section className={s.section}>
          <div className={s.closingInner}>
            <div>
              <h2 className={s.closingTitle}>
                {t("closing.title")} <span className={s.gradientText}>{t("closing.text")}</span>
              </h2>
              <p className={s.closingText}>
                {t("closing.closes", { closes: deadlineText(format, applications) })}
              </p>
              <Link href={apply} className={s.closingButton}>
                {page("applyNow")} <span aria-hidden="true">→</span>
              </Link>
              <div className={s.closingLinks}>
                <a href="#dates" className={s.link}>
                  {t("closing.info")}
                </a>
                <a href="#top" className={s.link}>
                  {t("closing.share")}
                </a>
              </div>
            </div>
            <Image
              src="/programs/nestle/key-visual-wide.webp"
              alt=""
              width={1920}
              height={1080}
              sizes="(min-width: 768px) 36rem, 100vw"
              className={s.closingVisual}
            />
          </div>
        </section>
      )}

      <NestleMenu
        items={sections.map((section) => ({ id: section, label: t(`nav.${section}`) }))}
        label={t("nav.label")}
        topLabel={t("nav.top")}
      />

      {applications && (
        <aside aria-label={t("pill.label")} className={s.pill}>
          <p className={s.pillText}>
            {open ? (
              <>
                <strong>{t("pill.closes", { date: day(applications.closesAt) })}</strong>
                <span>{t("pill.time")}</span>
              </>
            ) : program.phase === "upcoming" ? (
              <>
                <strong>{t("pill.opens", { date: day(applications.opensAt) })}</strong>
                <span>{t("pill.time")}</span>
              </>
            ) : (
              <>
                <strong>{t("pill.closed")}</strong>
                <span>{t("hero.facts.matchingDay.value")}</span>
              </>
            )}
          </p>
          {open && (
            <Link href={apply} className={s.pillButton}>
              {page("applyNow")}
            </Link>
          )}
        </aside>
      )}
    </div>
  );
}

export { NestlePage };
