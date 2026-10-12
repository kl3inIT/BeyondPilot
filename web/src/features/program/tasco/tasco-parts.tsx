import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

import { Note, SectionHead } from "../program-parts";

const businesses = ["retail", "tolling", "insurance", "roadside", "care", "charging"] as const;

/** What places Tasco for a reader: its listing, its toll business, the brands it sells and its shareholder. */
const marks = ["HNX: HUT", "VETC", "Geely", "Lynk & Co", "Mitsui"] as const;

const pilotSteps = ["selection", "week1", "week2", "week3", "week4", "decision"] as const;

const supportItems = ["briefing", "workshops", "mentors", "credits"] as const;

const myths = ["rnd", "procurement", "insurance", "weeks", "prize"] as const;

const label = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

/** A point argued in a few paragraphs under a section. */
export function Argument({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-2 border-t pt-6">
      <h3 className="font-semibold">{title}</h3>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/** Tasco as the client a team would win: the group, its businesses, and why it runs the challenge. */
export async function TascoClient() {
  const t = await getTranslations("Tasco.client");
  return (
    <section id="client" className="flex scroll-mt-6 flex-col gap-6">
      <SectionHead title={t("title")} lead={t("lead")} />
      <div className="flex max-w-3xl flex-col gap-3 text-muted-foreground">
        <p>{t("group")}</p>
        <p>{t("ecosystem")}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
        {businesses.map((business) => (
          <li key={business} className="border-l-2 border-primary pl-3 text-sm font-medium">
            {t(`businesses.${business}`)}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-2">
        {marks.map((mark) => (
          <li key={mark} className="flex">
            <Badge variant="outline">{mark}</Badge>
          </li>
        ))}
      </ul>
      <Argument title={t("why.title")} paragraphs={[t("why.ambition"), t("why.building")]} />
    </section>
  );
}

/** The month after demo day as a schedule: when, what happens, what a team brings and what ends the step. */
export async function PilotMonth() {
  const t = await getTranslations("Tasco.pilot");
  return (
    <section id="pilot" className="flex scroll-mt-6 flex-col gap-6">
      <SectionHead title={t("title")} lead={t("lead")} />
      <ol className="flex flex-col border-b">
        {pilotSteps.map((step) => (
          <li key={step} className="grid gap-x-8 gap-y-2 border-t py-5 md:grid-cols-4">
            <p className="text-sm font-semibold text-primary tabular-nums">
              {t(`steps.${step}.when`)}
            </p>
            <div className="flex flex-col gap-3 md:col-span-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{t(`steps.${step}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`steps.${step}.text`)}</p>
              </div>
              {step !== "decision" && (
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <dt className={label}>{t("bring")}</dt>
                    <dd>{t(`steps.${step}.bring`)}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className={label}>{t("done")}</dt>
                    <dd>{t(`steps.${step}.done`)}</dd>
                  </div>
                </dl>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="max-w-3xl text-lg font-medium">{t("format")}</p>
      <Note title={t("note.title")} text={t("note.text")} />
    </section>
  );
}

/** What a team is given while it builds, and the conditions that apply. */
export async function Support() {
  const t = await getTranslations("Tasco.support");
  return (
    <section id="support" className="flex scroll-mt-6 flex-col gap-6">
      <SectionHead title={t("title")} lead={t("lead")} />
      <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {supportItems.map((item) => (
          <li key={item} className="flex flex-col gap-0.5">
            <p className="font-medium">{t(`items.${item}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`items.${item}.text`)}</p>
          </li>
        ))}
      </ul>
      <p className="max-w-3xl text-xs text-muted-foreground">{t("conditions")}</p>
    </section>
  );
}

/**
 * What people assume beside what is true. From md the two columns share one heading row; below it
 * each side carries its own label, which is why the labels stay in the page for a screen reader.
 */
export async function Myths() {
  const t = await getTranslations("Tasco.myths");
  return (
    <section id="myths" className="flex scroll-mt-6 flex-col gap-6">
      <SectionHead title={t("title")} lead={t("lead")} />
      <div className="flex flex-col gap-3">
        <div aria-hidden="true" className={`hidden grid-cols-2 gap-x-8 md:grid ${label}`}>
          <p>{t("assume")}</p>
          <p>{t("truth")}</p>
        </div>
        <ul className="flex flex-col border-b">
          {myths.map((myth) => (
            <li key={myth} className="grid gap-x-8 gap-y-3 border-t py-5 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <p className={`md:sr-only ${label}`}>{t("assume")}</p>
                <p className="font-medium">{t(`items.${myth}.myth`)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className={`md:sr-only ${label}`}>{t("truth")}</p>
                <p className="text-sm text-muted-foreground">{t(`items.${myth}.truth`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
