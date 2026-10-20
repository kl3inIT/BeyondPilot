import { getTranslations } from "next-intl/server";
import { clockText } from "@/i18n/formats";

import type { ProgramFormat } from "../program-format";
import type { Step } from "../program-parts";
import { NestleAreas, type Area } from "./nestle-areas";
import s from "./nestle.module.css";

/** The five areas Nestlé named, each with what a provider may bring to it. */
const areas = [
  ["documents", ["extraction", "deliveryReconciliation", "translation", "hsCode", "importTax"]],
  ["marketing", ["trends", "preTesting", "campaignLearning", "budget"]],
  ["sales", ["salesData", "demand", "salesAnalytics", "tradeSpend"]],
  [
    "manufacturing",
    [
      "machinery",
      "maintenance",
      "vision",
      "robotics",
      "optimisation",
      "twins",
      "testing",
      "safety",
    ],
  ],
  ["legal", ["contracts", "regulatory", "issues", "hrPolicy"]],
] as const;

const kinds = [
  "solo",
  "students",
  "startups",
  "scaleups",
  "vendors",
  "integrators",
  "established",
] as const;

const needs = ["working", "data", "security", "pilot"] as const;

const questions = ["problem", "prove", "solution", "data", "tested", "capability"] as const;

const checks = ["protection", "integration", "references", "pilotReady"] as const;

const faqs = ["who", "finished", "after", "prize", "vietnam", "early", "ip", "hearBack"] as const;

/** What happens around the key dates: each line with its day, or without one when none is set. */
const supporting = [
  [
    "during",
    [
      ["infoSession", "infoSession"],
      ["screening", "screening"],
      ["briefings", "briefings"],
    ],
  ],
  [
    "before",
    [
      ["confirm", "confirm"],
      ["pack", null],
    ],
  ],
  [
    "after",
    [
      ["plans", "plans"],
      ["owner", null],
    ],
  ],
] as const;

/**
 * The challenge areas as a list of tabs beside one panel: how the work is done today, what good
 * looks like and what to bring. The sixth tab is the open invitation.
 */
export async function ChallengeAreas() {
  const t = await getTranslations("Nestle.areas");
  const list: Area[] = [
    ...areas.map(([id, bring]) => ({
      id,
      title: t(`items.${id}.title`),
      icon: `/programs/nestle/area-${id}.webp`,
      today: t(`items.${id}.today`),
      good: t(`items.${id}.good`),
      intro: id === "manufacturing" ? t("manufacturingIntro") : undefined,
      bring: bring.map((item) => t(`bringItems.${item}`)),
    })),
    {
      id: "more",
      title: t("more.title"),
      icon: "/programs/nestle/area-more.webp",
      body: t("more.body"),
    },
  ];
  return (
    <NestleAreas
      areas={list}
      labels={{ tabs: t("tabs"), today: t("today"), good: t("good"), bring: t("bring") }}
    />
  );
}

/** Who may apply, what an applicant needs, and the questions asked on Matching Day. */
export async function Eligibility() {
  const t = await getTranslations("Nestle.eligibility");
  return (
    <section id="eligibility" className={s.sectionTint}>
      <div className={s.container}>
        <h2 className={s.h2}>{t("title")}</h2>
        <p className={s.sectionLead}>{t("lead")}</p>
        <ul className={s.kinds}>
          {kinds.map((kind) => (
            <li key={kind} className={s.kind}>
              {t(`kinds.${kind}`)}
            </li>
          ))}
        </ul>
        <div className={s.need}>
          <h3 className={s.needTitle}>{t("need.title")}</h3>
          <ul className={s.needList}>
            {needs.map((need) => (
              <li key={need} className={s.needItem}>
                <span aria-hidden="true">✓</span>
                {t(`need.items.${need}`)}
              </li>
            ))}
          </ul>
        </div>
        <h3 className={s.questionsTitle}>{t("questions.title")}</h3>
        <p className={s.questionsLead}>{t("questions.lead")}</p>
        <ol className={s.questions}>
          {questions.map((question, index) => (
            <li key={question} className={s.question}>
              <span aria-hidden="true" className={s.questionNumber}>
                {index + 1}
              </span>
              <span className={s.questionText}>{t(`questions.items.${question}`)}</span>
            </li>
          ))}
        </ol>
        <div className={s.screening}>
          <strong className={s.screeningTitle}>{t("screening.title")}</strong>
          <ul className={s.screeningItems}>
            {checks.map((check) => (
              <li key={check} className={s.check}>
                {t(`screening.items.${check}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The program's steps as a row of dates joined by one line, each with its own colour. */
export async function NestleTimeline({
  steps,
  closesAt,
  format,
}: {
  steps: Step[];
  closesAt: string | null;
  format: ProgramFormat;
}) {
  const [t, page] = await Promise.all([getTranslations("Nestle.dates"), getTranslations("Nestle")]);
  return (
    <>
      <div className={s.start}>
        <strong className={s.startTitle}>{t("start")}</strong>
        <p className={s.startText}>{page("early.text")}</p>
      </div>
      <ol className={s.steps} data-count={steps.length}>
        {steps.map((step) => {
          const at = new Date(step.at);
          const note = step.note ?? (step.at === closesAt ? clockText(format, at) : null);
          return (
            <li key={`${step.at}-${step.title}`} className={s.step}>
              <span className={s.stepDate}>{format.dateTime(at, "day")}</span>
              <span aria-hidden="true" className={s.stepDot} />
              <h3 className={s.stepTitle}>{step.title}</h3>
              {note && <p className={s.stepNote}>{note}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** What runs beside the key dates, grouped by when it happens. */
export async function SupportingActivities() {
  const t = await getTranslations("Nestle.dates");
  return (
    <>
      <div className={s.supporting}>
        <h3 className={s.supportingTitle}>{t("supporting.title")}</h3>
        <div className={s.supportingGrid}>
          {supporting.map(([group, rows]) => (
            <div key={group} className={s.supportingGroup}>
              <h4 className={s.supportingGroupTitle}>{t(`supporting.groups.${group}`)}</h4>
              <dl className={s.supportingList}>
                {rows.map(([what, when]) => (
                  <div key={what} className={s.supportingRow}>
                    {when && <dt>{t(`supporting.when.${when}`)}</dt>}
                    <dd>{t(`supporting.what.${what}`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
      <p className={s.pocs}>{t("pocs")}</p>
    </>
  );
}

/** The questions asked about the program, each opening on its answer. */
export async function Faq() {
  const t = await getTranslations("Nestle.faq");
  return (
    <div className={s.faq}>
      {faqs.map((id) => (
        <details key={id} className={s.faqItem}>
          <summary className={s.faqSummary}>
            {t(`items.${id}.q`)}
            <span aria-hidden="true" className={s.faqMark} />
          </summary>
          <p className={s.faqAnswer}>{t(`items.${id}.a`)}</p>
        </details>
      ))}
    </div>
  );
}
