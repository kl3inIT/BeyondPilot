import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { CampaignCountdown } from "@/components/sections/events/campaign-countdown";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { liveCampaignDeadline, liveCampaignUrl, programApplyUrl } from "@/lib/site";

const facts = [
  { label: "notified", value: "notifiedWhen" },
  { label: "demoDay", value: "demoDayWhen" },
  { label: "investment", value: "investmentValue" },
] as const;

/** The live challenge as one example of the opportunities the ecosystem brings to BeyondPilot. */
function FeaturedChallenge() {
  const t = useTranslations("Home.challenge");
  const c = useTranslations("Campaign");

  return (
    <Section>
      <div className="flex flex-col pb-16 lg:pb-20">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <article className="mt-5 flex flex-col gap-6 rounded-3xl border bg-card p-4 lg:flex-row lg:gap-10 lg:p-5">
          <div className="flex min-h-72 flex-col justify-between gap-10 rounded-3xl bg-linear-145 from-panel-deep to-panel-bright px-6 pt-6 pb-10 text-panel-foreground lg:min-h-90 lg:w-130 lg:shrink-0 lg:px-8 lg:pt-8 lg:pb-20">
            <p className="text-sm font-medium">{c("partners")}</p>
            <p className="text-3xl font-semibold lg:text-quote">{c("question")}</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col lg:pt-5 lg:pr-5 lg:pb-1">
            <p className="flex flex-wrap items-center gap-3 text-copy text-muted-foreground">
              <Badge variant="success">{c("live")}</Badge>
              {c("kind")}
              <span>{t("partners")}</span>
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-headline lg:text-4xl">
              {c("name")}
            </h2>
            <p className="mt-3 text-lg leading-6.5 font-medium text-primary">
              <CampaignCountdown deadline={liveCampaignDeadline} />
            </p>
            <p className="mt-3.5 text-copy text-muted-foreground">{t("description")}</p>
            <dl className="mt-4 grid gap-4 border-y py-3 sm:grid-cols-3">
              {facts.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <dt className="text-caption text-muted-foreground">{c(`facts.${label}`)}</dt>
                  <dd className="text-xl font-semibold">{c(`facts.${value}`)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" href={programApplyUrl("insurance-ai-tasco")}>
                {c("applyNow")}
              </Button>
              <Button size="lg" prominence="secondary" href={liveCampaignUrl}>
                {c("readBrief")}
              </Button>
            </div>
          </div>
        </article>
      </div>
    </Section>
  );
}

export { FeaturedChallenge };
