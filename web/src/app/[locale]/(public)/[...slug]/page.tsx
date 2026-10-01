import { ArrowRightIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { Button } from "@/components/actions/button";
import { Link } from "@/i18n/navigation";
import { comingSoonPaths, liveCampaignUrl, siteRoutes } from "@/lib/site";

// Planned pages share one coming-soon screen; any other unknown path is the localized not-found page.
export default function PlaceholderPage({ params }: PageProps<"/[locale]/[...slug]">) {
  const { locale, slug } = use(params);
  setRequestLocale(locale);
  if (!comingSoonPaths.includes(slug.join("/") as (typeof comingSoonPaths)[number])) {
    notFound();
  }

  return <ComingSoon />;
}

function ComingSoon() {
  const t = useTranslations("ComingSoon");
  const c = useTranslations("Campaign");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<a href={liveCampaignUrl} />}>
          {c("applyNow")}
          <ArrowRightIcon aria-hidden="true" />
        </Button>
        <Button
          prominence="secondary"
          nativeButton={false}
          render={<Link href={siteRoutes.home} />}
        >
          {t("back")}
        </Button>
      </div>
    </div>
  );
}
