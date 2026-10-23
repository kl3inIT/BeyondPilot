import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMyPerkOptions } from "@/features/perk/perk-queries";
import { OwnPerkPage } from "@/features/perk/perk-record";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/perks/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.manage" });

  return { title: t("new"), robots: { index: false } };
}

export default async function NewOwnPerkRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/perks/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(`${siteRoutes.workspacePerks}/new`);

  return <OwnPerkPage options={await readMyPerkOptions()} claims={[]} />;
}
