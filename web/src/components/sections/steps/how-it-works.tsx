import { CalendarDaysIcon, CircleCheckIcon, FileTextIcon, TargetIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";

function Step({
  number,
  title,
  text,
  children,
}: {
  number: number;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-5">
      <div
        aria-hidden="true"
        className="flex h-70 items-center justify-center overflow-hidden rounded-xl border bg-muted/50 p-6 sm:p-8"
      >
        {children}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-xs text-background">
            {number}
          </span>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function ProviderName({ line }: { line: string }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/solutions/peregrin.svg" alt="" width={32} height={32} />
      <div>
        <p className="text-sm font-semibold">Peregrin</p>
        <p className="text-xs text-muted-foreground">{line}</p>
      </div>
    </div>
  );
}

/** Braintrust-style three columns: each step has its own small product picture. */
function HowItWorks() {
  const t = useTranslations("Home.steps");
  const c = useTranslations("Campaign.directions");
  const k = useTranslations("Home.bento.kinds");

  return (
    <Section>
      <div className="flex flex-col gap-12 sm:gap-24">
        <div className="flex flex-col items-center gap-4 text-center sm:gap-8">
          <h2 className="bg-linear-to-r from-foreground to-muted-foreground bg-clip-text text-3xl font-semibold text-balance text-transparent sm:text-5xl sm:leading-none">
            {t("title")}
          </h2>
          <p className="max-w-145 text-base text-muted-foreground sm:text-xl sm:font-medium">
            {t("description")}
          </p>
        </div>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
          <Step number={1} title={t("publish")} text={t("publishText")}>
            <div className="dark flex w-full flex-col gap-3 rounded-lg border bg-background p-4 text-foreground shadow-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{t("newUseCase")}</span>
                <span className="text-xs text-muted-foreground">{t("draft")}</span>
              </div>
              {[
                [t("fieldTitle"), t("fieldTitleValue")],
                [t("fieldOrg"), t("fieldOrgValue")],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="truncate rounded-md border bg-input/25 px-2 py-1.5 text-xs">
                    {value}
                  </span>
                </div>
              ))}
              <span className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                {t("submit")}
              </span>
            </div>
          </Step>
          <Step number={2} title={t("receive")} text={t("receiveText")}>
            <div className="relative w-full pt-11">
              {/* An earlier proposal waits behind the newest one. */}
              <p className="absolute inset-x-3 top-0 rounded-lg border bg-background px-4 py-3.5 text-xs font-medium text-muted-foreground opacity-60 shadow-md">
                Polymath · {k("proofInPocket")}
              </p>
              <div className="relative flex w-full flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg">
                <ProviderName line={t("proposalTeam")} />
                {[
                  { icon: TargetIcon, label: t("proposalDirection") },
                  { icon: FileTextIcon, label: t("proposalFile") },
                  { icon: CalendarDaysIcon, label: t("proposalSubmitted") },
                ].map(({ icon: Icon, label }) => (
                  <p key={label} className="flex items-center gap-2 text-xs">
                    <Icon className="size-3.5 text-muted-foreground" />
                    {label}
                  </p>
                ))}
              </div>
            </div>
          </Step>
          <Step number={3} title={t("review")} text={t("reviewText")}>
            <div className="flex w-full flex-col gap-3 rounded-lg border border-brand bg-background p-4 shadow-lg ring-1 ring-brand">
              <div className="flex items-center justify-between">
                <ProviderName line={c("claimingA")} />
                <CircleCheckIcon className="size-5 text-success" />
              </div>
              <Badge variant="brand">{t("shortlistedDemo")}</Badge>
              <p className="flex items-center gap-2 text-xs">
                <CalendarDaysIcon className="size-3.5 text-muted-foreground" />
                {t("demoDayWhen")}
              </p>
            </div>
          </Step>
        </ol>
      </div>
    </Section>
  );
}

export { HowItWorks };
