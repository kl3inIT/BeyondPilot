import { cn } from "cn";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/actions/button";
import { Section } from "@/components/ui/section";
import { liveCampaignUrl } from "@/lib/site";

/** Product screens of the challenge, each on the tint its number chip carries. */
const stations = [
  { id: "opens", image: "challenge", chip: "bg-sky text-sky-foreground" },
  { id: "discover", image: "search-results", chip: "bg-mint text-mint-foreground" },
  { id: "apply", image: "application", chip: "bg-peach text-peach-foreground" },
  { id: "assess", image: "reviews", chip: "bg-sky text-sky-foreground" },
  { id: "shortlist", image: "shortlist", chip: "bg-mint text-mint-foreground" },
] as const;

/**
 * How the live challenge moves through the product, in five stations. Five columns with a rail from
 * the widest desktop; three and two columns on tablets; one column on phones.
 */
function ChallengeTimeline() {
  const t = useTranslations("HowItWorks.example");
  const c = useTranslations("Campaign");
  const dates = [
    { label: t("closes"), value: t("closesWhen") },
    { label: c("facts.demoDay"), value: c("facts.demoDayWhen") },
    { label: c("facts.investment"), value: c("facts.investmentValue") },
  ];

  return (
    <Section surface="muted">
      <div className="flex flex-col gap-10 py-16 lg:gap-14 lg:py-24">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h2 className="max-w-190 text-3xl font-semibold tracking-headline md:text-4xl">
            {t("title")}
          </h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-6 desktop:grid-cols-5 desktop:gap-0">
          {stations.map(({ id, image, chip }, index) => (
            <li
              key={id}
              className={cn(
                "flex flex-col gap-4 desktop:col-span-1",
                index < 3 ? "md:col-span-2" : "md:col-span-3",
              )}
            >
              <div aria-hidden="true" className="hidden items-center desktop:flex">
                <span className="size-3 shrink-0 rounded-full bg-primary" />
                {index < stations.length - 1 && <span className="h-px flex-1 bg-input" />}
              </div>
              <div className="flex flex-1 desktop:pr-4">
                <div className="flex w-full flex-col gap-4 rounded-2xl border bg-card p-3">
                  <div className="aspect-video overflow-hidden rounded-xl border bg-muted md:aspect-auto md:h-35">
                    <Image
                      src={`/landing/how-it-works/${image}.png`}
                      alt=""
                      width={1040}
                      height={600}
                      sizes="(min-width: 1440px) 14rem, (min-width: 768px) 30vw, 100vw"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-start gap-2 px-1 pb-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", chip)}>
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{t(`${id}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`${id}.description`)}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-6 rounded-2xl bg-sky p-6 md:flex-row md:items-center md:justify-between md:px-8">
          <dl className="flex flex-col gap-4 md:flex-row md:gap-14">
            {dates.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-foreground/80">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <Button size="2xl" prominence="secondary" href={liveCampaignUrl}>
            {c("readBrief")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export { ChallengeTimeline };
