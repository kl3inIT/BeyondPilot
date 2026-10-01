import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Glow } from "@/components/ui/glow";
import { Section } from "@/components/ui/section";
import { genaiFundLinks, siteRoutes } from "@/lib/site";

function Cta() {
  const t = useTranslations("Home.cta");

  return (
    <div className="relative overflow-hidden">
      <Section spacing="none">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-8 pt-16 pb-24 text-center sm:gap-12 sm:pt-32 sm:pb-48">
          <h2 className="text-3xl font-semibold text-balance sm:text-5xl sm:leading-none">
            {t("title")}
          </h2>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
            <Button href={siteRoutes.publishUseCase}>{t("publish")}</Button>
            <Button prominence="secondary" href={`mailto:${genaiFundLinks.email}`}>
              {t("talk")}
            </Button>
          </div>
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground">
            {t("talentQuestion")}
            <TextButton href={siteRoutes.talentProfile}>
              {t("talentLink")}
              <ArrowRightIcon aria-hidden="true" />
            </TextButton>
          </p>
        </div>
      </Section>
      <Glow variant="bottom" />
    </div>
  );
}

export { Cta };
