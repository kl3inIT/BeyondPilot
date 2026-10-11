import { ArrowUpRightIcon, MessageSquareTextIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

const steps = [
  { id: "tell", Icon: MessageSquareTextIcon },
  { id: "discover", Icon: SearchIcon },
  { id: "move", Icon: ArrowUpRightIcon },
] as const;

const matters = [1, 2, 3] as const;
const options = [
  { row: 1, logo: "/landing/logo-revve.jpeg" },
  { row: 2, logo: "/landing/logo-shieldbase.png" },
] as const;

/**
 * What the AI adoption agent adds, in the order a visitor goes through it, beside one journey
 * drawn as a conversation on the ink of the challenge cover (Figma "Landing v2 / HowItWorks"). The
 * journey is an illustration naming two real listings: it is one image to assistive technology,
 * and what is not built yet says so.
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
          aria-label={`${h("previewLabel")}: ${t("demo.alt")}`}
          className="min-w-0 flex-1 self-start overflow-hidden rounded-3xl bg-linear-145 from-panel-deep to-panel-bright text-panel-foreground shadow-float"
        >
          <div aria-hidden="true" className="flex flex-col gap-5 p-4 md:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-foreground/15">
                <SparklesIcon className="size-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t("demo.title")}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-xs font-medium text-panel-foreground/70">{t("demo.need")}</p>
              <p className="max-w-md rounded-2xl rounded-tr-sm bg-panel-foreground px-4 py-3 text-base font-medium text-panel-deep">
                {t("demo.needQuote")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-panel-foreground/70">{t("demo.matters")}</p>
              <ul className="flex flex-wrap gap-2">
                {matters.map((matter) => (
                  <li
                    key={matter}
                    className="rounded-full border border-panel-foreground/30 bg-panel-foreground/10 px-2.5 py-1 text-xs font-medium"
                  >
                    {t(`demo.matter${matter}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-panel-foreground/70">{t("demo.options")}</p>
              <ul className="flex flex-col gap-2">
                {options.map(({ row, logo }) => (
                  <li
                    key={row}
                    className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-card-foreground"
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border bg-card">
                      <Image src={logo} alt="" fill sizes="40px" className="object-cover" />
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
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-panel-foreground/70">{t("demo.next")}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="flex h-8 items-center justify-center rounded-full bg-panel-foreground px-3.5 text-sm font-semibold text-panel-deep">
                  {t("demo.introduce")}
                </span>
                <span className="flex items-center gap-2 self-start rounded-full border border-dashed border-panel-foreground/40 px-3 py-1.5 text-xs font-medium text-panel-foreground/80 sm:self-auto">
                  {t("demo.shortlist")}
                  <span className="rounded-full bg-panel-foreground/15 px-2 py-0.5 font-semibold">
                    {h("comingSoon")}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export { AgentJourney };
