import { CheckIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SectionHead } from "../program-parts";

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

const label = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

function AreaIcon({ area, size }: { area: string; size: 32 | 56 }) {
  return (
    <Image
      src={`/programs/nestle/area-${area}.webp`}
      alt=""
      width={size}
      height={size}
      className={size === 56 ? "size-14 shrink-0" : "size-8 shrink-0"}
    />
  );
}

/** One area's panel: its picture and name above what the panel says. */
function AreaPanel({
  area,
  title,
  children,
}: {
  area: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent value={area}>
      <div className="flex flex-col gap-6 rounded-xl border bg-card p-5 md:p-8">
        <div className="flex items-center gap-4">
          <AreaIcon area={area} size={56} />
          <h3 className="text-xl font-semibold tracking-title text-foreground md:text-2xl">
            {title}
          </h3>
        </div>
        {children}
      </div>
    </TabsContent>
  );
}

/**
 * The challenge areas as six tabs beside one panel: how the work is done today, what good looks
 * like and what to bring. The sixth tab is the open invitation.
 */
export async function ChallengeAreas() {
  const t = await getTranslations("Nestle.areas");
  return (
    <Tabs defaultValue="documents" orientation="vertical" className="flex-col md:flex-row">
      <TabsList
        variant="boxed"
        aria-label={t("tabs")}
        className="mb-2 md:mr-4 md:mb-0 md:w-64 md:shrink-0"
      >
        {areas.map(([area]) => (
          <TabsTrigger key={area} value={area}>
            <AreaIcon area={area} size={32} />
            {t(`items.${area}.title`)}
          </TabsTrigger>
        ))}
        <TabsTrigger value="more">
          <AreaIcon area="more" size={32} />
          {t("more.title")}
        </TabsTrigger>
      </TabsList>
      {areas.map(([area, bring]) => (
        <AreaPanel key={area} area={area} title={t(`items.${area}.title`)}>
          <dl className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <dt className={label}>{t("today")}</dt>
              <dd className="text-base text-muted-foreground">{t(`items.${area}.today`)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={label}>{t("good")}</dt>
              <dd className="text-base text-muted-foreground">{t(`items.${area}.good`)}</dd>
            </div>
            <div className="flex flex-col gap-2">
              <dt className={label}>{t("bring")}</dt>
              <dd className="flex flex-col gap-2">
                {area === "manufacturing" && (
                  <p className="text-base text-muted-foreground">{t("manufacturingIntro")}</p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {bring.map((item) => (
                    <li key={item} className="flex">
                      <Badge variant="outline">{t(`bringItems.${item}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </AreaPanel>
      ))}
      <AreaPanel area="more" title={t("more.title")}>
        <p className="text-base text-muted-foreground">{t("more.body")}</p>
      </AreaPanel>
    </Tabs>
  );
}

/** Who may apply, what an applicant needs, and the questions asked on Matching Day. */
export async function Eligibility() {
  const t = await getTranslations("Nestle.eligibility");
  return (
    <section id="eligibility" className="flex scroll-mt-6 flex-col gap-8">
      <div className="flex flex-col gap-5">
        <SectionHead title={t("title")} lead={t("lead")} />
        <ul className="flex flex-wrap gap-2">
          {kinds.map((kind) => (
            <li key={kind} className="flex">
              <Badge variant="outline">{t(`kinds.${kind}`)}</Badge>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-primary p-6 text-primary-foreground">
        <h3 className="text-lg font-semibold">{t("need.title")}</h3>
        <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {needs.map((need) => (
            <li key={need} className="flex gap-3 text-sm font-medium">
              <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(`need.items.${need}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold tracking-title">{t("questions.title")}</h3>
          <p className="max-w-3xl text-sm text-muted-foreground">{t("questions.lead")}</p>
        </div>
        <ol className="grid gap-x-10 md:grid-cols-2">
          {questions.map((question, index) => (
            <li key={question} className="flex gap-4 border-t py-4">
              <span
                aria-hidden="true"
                className="w-4 shrink-0 text-lg font-semibold text-primary tabular-nums"
              >
                {index + 1}
              </span>
              <span className="font-medium">{t(`questions.items.${question}`)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-sm font-semibold">{t("screening.title")}</h3>
          <ul className="flex flex-wrap gap-2">
            {checks.map((check) => (
              <li key={check} className="flex">
                <Badge variant="secondary">{t(`screening.items.${check}`)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** What runs beside the key dates, grouped by when it happens. */
export async function SupportingActivities() {
  const t = await getTranslations("Nestle.dates");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-5 rounded-2xl bg-muted p-6 md:p-8">
        <h3 className={label}>{t("supporting.title")}</h3>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {supporting.map(([group, rows]) => (
            <div key={group} className="flex flex-col gap-3">
              <h4 className="font-semibold">{t(`supporting.groups.${group}`)}</h4>
              <ul className="flex flex-col gap-2.5 text-sm">
                {rows.map(([what, when]) => (
                  <li key={what} className="flex flex-col">
                    {when && <span className="font-semibold">{t(`supporting.when.${when}`)}</span>}
                    <span className="text-muted-foreground">{t(`supporting.what.${what}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground md:text-right">{t("pocs")}</p>
    </div>
  );
}
