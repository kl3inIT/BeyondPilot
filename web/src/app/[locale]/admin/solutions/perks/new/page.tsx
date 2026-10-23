import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readAdminPerkOptions } from "@/features/perk/perk-queries";
import { AdminPerkPage } from "@/features/perk/perk-record";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/perks/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.manage" });

  return { title: t("new"), robots: { index: false } };
}

export default async function NewAdminPerkRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/solutions/perks/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { organizationId } = await searchParams;
  await requireRole("operator", `${siteRoutes.adminPerks}/new`);
  // The organization that gives the perk is chosen before the form opens.
  if (typeof organizationId !== "string" || organizationId === "") {
    notFound();
  }
  const options = await readAdminPerkOptions(organizationId).catch(() => notFound());

  return <AdminPerkPage options={options} claims={[]} organizationId={organizationId} />;
}
