import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

/**
 * The last invitation, on the ink of the challenge bar (Figma "Landing v2 / FinalCTA"); at night
 * the panel turns light with the rest of the inverse surfaces.
 */
function FinalCta() {
  const t = useTranslations("Home.finalCta");

  return (
    <Section>
      <div className="mb-14 flex flex-col items-center rounded-3xl bg-foreground px-6 py-14 text-center text-background md:p-15 lg:mb-25 lg:py-20">
        <h2 className="max-w-3xl text-4xl font-semibold md:text-5xl lg:text-cta lg:tracking-display">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-xl text-base text-background/75 lg:text-lg">{t("description")}</p>
        <Button size="2xl" href={siteRoutes.solutions} className="mt-9">
          {t("action")}
        </Button>
      </div>
    </Section>
  );
}

export { FinalCta };
