import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  MapPinIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";

/**
 * A read-only picture of the campaign detail page for the live challenge. It is illustration, not
 * navigation: the real call to action sits in the hero buttons and the badge.
 */
function CampaignMockup() {
  const t = useTranslations("Campaign");
  const s = useTranslations("Site");
  const directions = [
    {
      title: t("directions.buying"),
      text: t("directions.buyingText"),
      tags: [t("directions.buyingA"), t("directions.buyingB")],
    },
    {
      title: t("directions.carrying"),
      text: t("directions.carryingText"),
      tags: [t("directions.carryingA"), t("directions.carryingB")],
    },
    {
      title: t("directions.claiming"),
      text: t("directions.claimingText"),
      tags: [t("directions.claimingA"), t("directions.claimingB")],
    },
  ];
  const dates = [
    [t("opens"), "23 Sep"],
    [t("briefing"), "7 Oct"],
    [t("submissionsClose"), "15 Oct"],
    [t("demoDay"), "22 Oct"],
    [t("investment"), t("investmentValue")],
  ];

  return (
    <div aria-hidden="true" className="w-full bg-background text-left">
      <div className="hidden items-center justify-between border-b px-6 py-3 md:flex">
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-3">
            <span className="font-semibold">BeyondPilot</span>
            <span className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
              <span className="h-4 w-px bg-border" />
              {s("poweredBy")}
              <Image
                src="/brand/genaifund-logo.png"
                alt=""
                width={1200}
                height={252}
                className="h-3 w-auto dark:hidden"
              />
              <Image
                src="/brand/genaifund-logo-white.png"
                alt=""
                width={1200}
                height={254}
                className="hidden h-3 w-auto dark:block"
              />
            </span>
          </span>
          <span className="font-medium">Programs</span>
          <span className="text-muted-foreground">Use cases</span>
          <span className="text-muted-foreground">AI solutions</span>
          <span className="text-muted-foreground">AI talent</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex w-56 items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
            <SearchIcon className="size-3.5" />
            {t("searchPlaceholder")}
          </div>
          <Image
            src="/talent/face-47.jpg"
            alt=""
            width={64}
            height={64}
            className="size-8 rounded-full border"
          />
        </div>
      </div>
      <div className="flex gap-8 p-5 md:p-8">
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t("breadcrumb")}</p>
            <p className="text-xl font-semibold md:text-3xl">{t("name")}</p>
            <p className="hidden max-w-2xl text-sm text-muted-foreground md:block">
              {t("question")}
            </p>
            <p className="text-sm text-muted-foreground md:hidden">{t("questionShort")}</p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
              <Badge variant="success">{t("liveNow")}</Badge>
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5" />
                {t("closesLong")}
              </span>
              <span className="hidden items-center gap-1.5 md:flex">
                <UsersIcon className="size-3.5" />
                {t("teams")}
              </span>
              <span className="hidden items-center gap-1.5 md:flex">
                <MapPinIcon className="size-3.5" />
                {t("region")}
              </span>
            </div>
          </div>
          <div className="hidden gap-6 border-b text-sm md:flex">
            <span className="border-b-2 border-foreground pb-2.5 font-medium">
              {t("tabs.directions")}
            </span>
            <span className="text-muted-foreground">{t("tabs.challenge")}</span>
            <span className="text-muted-foreground">{t("tabs.eligibility")}</span>
            <span className="text-muted-foreground">{t("tabs.timeline")}</span>
            <span className="text-muted-foreground">{t("tabs.pilot")}</span>
          </div>
          <ul className="flex flex-col gap-3">
            {directions.map((direction) => (
              <li
                key={direction.title}
                className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 md:px-5 md:py-4"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-sm font-medium md:text-base">{direction.title}</p>
                  <p className="hidden text-sm text-muted-foreground md:block">{direction.text}</p>
                  <p className="text-xs text-muted-foreground md:hidden">{direction.tags[0]}</p>
                  <div className="hidden gap-1.5 pt-1 md:flex">
                    {direction.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ArrowRightIcon className="size-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
          <span className="flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground md:hidden">
            {t("applyNow")}
          </span>
        </div>
        <div className="hidden w-80 shrink-0 flex-col gap-4 self-start rounded-xl border bg-card p-5 shadow-sm lg:flex">
          <div className="flex flex-col gap-2">
            <p className="font-medium">{t("applyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("applyText")}</p>
          </div>
          <span className="flex h-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
            {t("applyNow")}
          </span>
          <span className="flex h-9 items-center justify-center rounded-md border text-sm font-medium">
            {t("readBrief")}
          </span>
          <div className="flex flex-col gap-2.5 border-t pt-4">
            <p className="text-sm font-medium">{t("keyDates")}</p>
            {dates.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 border-t pt-4">
            <p className="text-sm font-medium">{t("whoCanApply")}</p>
            {[t("whoA"), t("whoB"), t("whoC")].map((who) => (
              <p key={who} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheckIcon className="size-3.5 text-success" />
                {who}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CampaignMockup };
