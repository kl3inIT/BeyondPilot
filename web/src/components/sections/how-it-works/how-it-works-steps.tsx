import { useTranslations } from "next-intl";

import { Section } from "@/components/ui/section";

/** `note` is only on the step whose example carries a second, smaller line. */
const steps = [
  { id: "tell", hasNote: false },
  { id: "discover", hasNote: true },
  { id: "move", hasNote: false },
] as const;

/** The three steps as ruled rows: what BeyondPilot does on the left, what the visitor sees on the right. */
function HowItWorksSteps() {
  const t = useTranslations("HowItWorks.steps");

  return (
    <Section>
      <div className="flex flex-col gap-10 pt-10 pb-16 lg:pb-24">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
            <h2 className="max-w-150 text-3xl font-semibold tracking-headline md:text-4xl">
              {t("title")}
            </h2>
          </div>
          <span className="rounded-full bg-sky px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-sky-foreground">
            {t("badge")}
          </span>
        </div>
        <ol className="flex flex-col border-b">
          {steps.map(({ id, hasNote }, index) => (
            <li
              key={id}
              className="flex flex-col gap-6 border-t py-9 md:flex-row md:items-start md:gap-10 md:[&>*]:flex-1"
            >
              <div className="flex flex-col gap-2 md:max-w-120">
                <span className="text-sm font-semibold text-sky-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-3xl font-semibold tracking-headline">{t(`${id}.title`)}</h3>
                <p className="max-w-105 text-base text-muted-foreground">
                  {t(`${id}.description`)}
                </p>
              </div>
              <div className="flex gap-5 md:max-w-170">
                <span aria-hidden="true" className="w-0.5 shrink-0 bg-brand" />
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    {t(`${id}.label`)}
                  </p>
                  <p className="text-lg">{t(`${id}.example`)}</p>
                  {hasNote && <p className="text-sm text-muted-foreground">{t("discover.note")}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export { HowItWorksSteps };
