import { ArrowUpRightIcon, MessageSquareTextIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PreviewBadge } from "@/components/sections/preview-badge";
import { Section } from "@/components/ui/section";

const steps = [
  { id: "tell", Icon: MessageSquareTextIcon },
  { id: "discover", Icon: SearchIcon },
  { id: "move", Icon: ArrowUpRightIcon },
] as const;

const matters = [1, 2, 3] as const;
const options = [
  { row: 1, monogram: "PA" },
  { row: 2, monogram: "IN" },
] as const;

/**
 * What the AI adoption agent adds, in the order a visitor goes through it, beside one journey
 * drawn as a preview (Figma "Landing v2 / HowItWorks"). The journey is an illustration: it is one
 * image to assistive technology, and what is not built yet says so.
 */
function AgentJourney() {
  const t = useTranslations("Home.agentJourney");
  const h = useTranslations("Home");

  return (
    <Section surface="muted">
      <div className="flex flex-col gap-10 py-16 lg:flex-row lg:gap-16 lg:py-24">
        <div className="flex flex-col lg:w-115 lg:shrink-0">
          <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-headline">{t("title")}</h2>
          <ol className="mt-8 flex flex-col gap-7">
            {steps.map(({ id, Icon }, index) => (
              <li key={id} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-primary">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("step", { number: index + 1 })}
                  </p>
                  <h3 className="text-lg font-semibold">{t(`${id}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`${id}.description`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div
          role="img"
          aria-label={`${h("previewLabel")}: ${t("demo.title")}. ${t("demo.needQuote")}`}
          className="min-w-0 flex-1 self-start overflow-hidden rounded-3xl border bg-card shadow-float"
        >
          <div aria-hidden="true">
            <div className="flex items-center gap-3 border-b bg-muted px-5 py-3.5">
              <SparklesIcon className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t("demo.title")}</p>
              <PreviewBadge>{h("previewLabel")}</PreviewBadge>
            </div>
            <div className="flex flex-col gap-5 p-4 md:p-6">
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("demo.need")}
                </p>
                <p className="rounded-xl bg-accent px-4 py-3 text-base font-medium">
                  {t("demo.needQuote")}
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("demo.matters")}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {matters.map((matter) => (
                    <li
                      key={matter}
                      className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium"
                    >
                      {t(`demo.matter${matter}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("demo.options")}
                </p>
                <ul className="divide-y rounded-xl border">
                  {options.map(({ row, monogram }) => (
                    <li key={row} className="flex gap-3 px-3.5 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-solution">
                        {monogram}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{t(`demo.option${row}Title`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`demo.option${row}Why`)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("demo.next")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="flex h-8 items-center justify-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground">
                    {t("demo.introduce")}
                  </span>
                  <span className="flex items-center gap-2 self-start rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground sm:self-auto">
                    {t("demo.shortlist")}
                    <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-primary">
                      {h("comingSoon")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export { AgentJourney };
