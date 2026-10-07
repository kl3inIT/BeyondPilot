import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

/** The page title with the one invitation that leaves it. */
function HowItWorksIntro() {
  const t = useTranslations("HowItWorks.intro");

  return (
    <Section>
      <div className="flex flex-col items-start gap-5 pt-12 pb-10 md:pt-20 lg:pt-24 lg:pb-14">
        <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
        <h1 className="max-w-150 text-4xl font-semibold tracking-headline md:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-160 text-lg text-muted-foreground">{t("description")}</p>
        <Button size="2xl" prominence="inverse" href={siteRoutes.solutions}>
          {t("action")}
        </Button>
      </div>
    </Section>
  );
}

export { HowItWorksIntro };
