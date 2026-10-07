import { cn } from "cn";
import { useTranslations } from "next-intl";

import { Section } from "@/components/ui/section";

/** The three steps, each on its own tint. */
const steps = [
  { id: "tell", tint: "border-sky-foreground/20 bg-sky", ink: "text-sky-foreground" },
  { id: "discover", tint: "border-lilac-foreground/20 bg-lilac", ink: "text-lilac-foreground" },
  { id: "move", tint: "border-peach-foreground/20 bg-peach", ink: "text-peach-foreground" },
] as const;

/** What the AI adoption agent adds, in the order a visitor goes through it. */
function AgentJourney() {
  const t = useTranslations("Home.agentJourney");

  return (
    <Section>
      <div className="flex flex-col pb-16 lg:pb-30">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-headline lg:text-section lg:tracking-section">
          {t("title")}
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14 lg:gap-6">
          {steps.map(({ id, tint, ink }, index) => (
            <li key={id} className={cn("flex flex-col rounded-2xl border p-6 lg:min-h-50", tint)}>
              <span className={cn("text-caption font-semibold", ink)}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-step font-semibold">{t(`${id}.title`)}</h3>
              <p className="mt-4 text-copy text-muted-foreground lg:leading-6">
                {t(`${id}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export { AgentJourney };
