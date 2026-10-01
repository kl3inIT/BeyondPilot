import { useTranslations } from "next-intl";

import { RisingArc } from "@/components/ui/rising-arc";
import { Section } from "@/components/ui/section";

/** A quiet breathing section: the rising brand-coloured arc from Launch UI. */
function EcosystemArc() {
  const t = useTranslations("Home.ecosystem");

  return (
    <div className="overflow-hidden">
      <Section spacing="rising">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-12">
          <h2 className="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-semibold text-balance text-transparent sm:text-5xl md:text-7xl md:leading-none dark:to-muted-foreground">
            {t("title")}
          </h2>
          <p className="max-w-145 text-base text-muted-foreground sm:text-xl sm:font-medium">
            {t("description")}
          </p>
        </div>
        <div className="mt-16 sm:mt-24">
          <RisingArc />
        </div>
      </Section>
    </div>
  );
}

export { EcosystemArc };
