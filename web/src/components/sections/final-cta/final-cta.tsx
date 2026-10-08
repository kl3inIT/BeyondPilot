import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

/** The last invitation, on the same wash of azure, violet and peach as the hero. */
function FinalCta() {
  const t = useTranslations("Home.finalCta");

  return (
    <Section>
      <div className="mb-14 flex flex-col items-start rounded-3xl bg-linear-90 from-wash-azure via-wash-violet via-55% to-wash-peach p-8 md:p-15 lg:mb-25 lg:min-h-75 lg:pt-17.5">
        <h2 className="max-w-3xl text-4xl font-semibold text-foreground md:text-5xl lg:text-cta lg:tracking-display">
          {t("title")}
        </h2>
        <p className="mt-4 text-base text-muted-foreground lg:text-lg">{t("description")}</p>
        <Button size="2xl" prominence="inverse" href={siteRoutes.solutions} className="mt-9.5">
          {t("action")}
        </Button>
      </div>
    </Section>
  );
}

export { FinalCta };
