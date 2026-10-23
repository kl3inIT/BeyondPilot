import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMyPerk, readMyPerkClaims, readMyPerkOptions } from "@/features/perk/perk-queries";
import { OwnPerkPage } from "@/features/perk/perk-record";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/perks/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.team" });
  const perk = await readMyPerk(id).catch(() => null);

  return { title: perk ? perk.title + titleSuffix : t("metaTitle"), robots: { index: false } };
}

export default async function OwnPerkRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/perks/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${siteRoutes.workspacePerks}/${id}`);
  const perk = await readMyPerk(id);
  if (!perk) {
    notFound();
  }
  const [options, claims] = await Promise.all([readMyPerkOptions(), readMyPerkClaims(id)]);

  return <OwnPerkPage perk={perk} options={options} claims={claims} />;
}
