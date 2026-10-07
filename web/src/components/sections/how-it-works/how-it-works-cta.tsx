import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

/** The last invitation, on a wash of sky, mint and peach. */
function HowItWorksCta() {
  const t = useTranslations("Home.finalCta");

  return (
    <Section>
      <div className="mb-16 flex flex-col items-start gap-6 rounded-4xl bg-linear-90 from-sky via-mint via-55% to-peach p-8 md:p-15 lg:mb-24">
        <h2 className="max-w-3xl text-4xl font-semibold tracking-headline md:text-5xl">
          {t("title")}
        </h2>
        <p className="text-lg text-muted-foreground">{t("description")}</p>
        <Button size="2xl" prominence="inverse" href={siteRoutes.solutions}>
          {t("action")}
        </Button>
      </div>
    </Section>
  );
}

export { HowItWorksCta };
