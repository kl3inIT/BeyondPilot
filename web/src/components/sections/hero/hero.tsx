import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { CampaignMockup } from "@/components/sections/hero/campaign-mockup";
import { Glow } from "@/components/ui/glow";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { Section } from "@/components/ui/section";
import { liveCampaignUrl, siteRoutes } from "@/lib/site";

function Hero() {
  const t = useTranslations("Home.hero");
  const c = useTranslations("Campaign");

  return (
    <div className="overflow-hidden">
      <Section spacing="openBottom">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-12">
          <a
            href={liveCampaignUrl}
            className="flex animate-appear items-center gap-2.5 rounded-full border py-1 pr-3 pl-1 text-xs motion-reduce:animate-none"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 font-semibold text-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              {c("live")}
            </span>
            <span className="font-medium">
              <span className="sm:hidden">{c("shortName")}</span>
              <span className="hidden sm:inline">{c("name")}</span>
            </span>
            <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
            <span className="hidden text-muted-foreground sm:inline">{c("closes")}</span>
            <span className="flex items-center gap-1 font-semibold">
              {c("apply")}
              <ArrowRightIcon className="size-3" aria-hidden="true" />
            </span>
          </a>
          <h1 className="relative z-10 inline-block animate-appear bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-4xl leading-tight font-semibold text-balance text-transparent drop-shadow-2xl motion-reduce:animate-none sm:text-6xl sm:leading-tight md:text-8xl md:leading-none dark:to-muted-foreground">
            {t("title")}
          </h1>
          <p className="relative z-10 max-w-136 animate-appear text-base font-medium text-muted-foreground opacity-0 delay-100 motion-reduce:animate-none motion-reduce:opacity-100 sm:text-xl">
            {t("description")}
          </p>
          <div className="relative z-10 flex w-full animate-appear flex-col justify-center gap-3 opacity-0 delay-300 motion-reduce:animate-none motion-reduce:opacity-100 sm:w-auto sm:flex-row sm:gap-4">
            <Button href={siteRoutes.programs}>{t("browse")}</Button>
            <Button prominence="secondary" href={siteRoutes.publishUseCase}>
              {t("publish")}
            </Button>
          </div>
          <div className="relative w-full pt-4 sm:pt-12">
            <div className="relative animate-appear opacity-0 delay-700 motion-reduce:animate-none motion-reduce:opacity-100">
              <MockupFrame>
                <Mockup type="inset" className="w-full">
                  <CampaignMockup />
                </Mockup>
              </MockupFrame>
              {/* The screen fades into the page, as in the Figma hero. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 bg-linear-to-b from-background/0 to-background/90 to-85%"
              />
            </div>
            <div className="animate-appear-zoom opacity-0 delay-1000 motion-reduce:animate-none motion-reduce:opacity-100">
              <Glow variant="top" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

export { Hero };
