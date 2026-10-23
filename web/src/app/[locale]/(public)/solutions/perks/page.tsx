import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readPerks } from "@/features/perk/perk-queries";
import { PerksPage } from "@/features/perk/perks-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/perks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.catalogue" });

  return { title: t("metaTitle"), description: t("lead") };
}

export default async function PerksRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/solutions/perks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ended = (await searchParams).ended === "true";

  return <PerksPage perks={await readPerks(ended)} ended={ended} />;
}
