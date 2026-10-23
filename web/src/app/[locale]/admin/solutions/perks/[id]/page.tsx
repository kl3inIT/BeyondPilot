import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  readAdminPerk,
  readAdminPerkClaims,
  readAdminPerkOptions,
} from "@/features/perk/perk-queries";
import { AdminPerkPage } from "@/features/perk/perk-record";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/perks/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.manage" });
  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const perk = await readAdminPerk(id).catch(() => null);

  return { title: perk ? perk.title + titleSuffix : t("metaTitle"), robots: { index: false } };
}

export default async function AdminPerkRoute({
  params,
}: PageProps<"/[locale]/admin/solutions/perks/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminPerks}/${id}`);
  const perk = await readAdminPerk(id);
  if (!perk) {
    notFound();
  }
  const [options, claims] = await Promise.all([
    readAdminPerkOptions(perk.organizationId),
    readAdminPerkClaims(id),
  ]);

  return <AdminPerkPage perk={perk} options={options} claims={claims} />;
}
