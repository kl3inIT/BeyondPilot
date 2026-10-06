import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminOrganizationPage } from "@/features/organization/admin-organization-page";
import { loadAdminOrganizationSearch } from "@/features/organization/admin-organization-search";
import { readAdminOrganization } from "@/features/organization/organization-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/organizations/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.organizations" });

  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const record = await readAdminOrganization(id).catch(() => null);

  return {
    title: record ? record.organization.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminOrganizationRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/organizations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminOrganizations}/${id}`);
  const { tab, page } = await loadAdminOrganizationSearch(searchParams);
  const detail = await readAdminOrganization(id);
  if (!detail) {
    notFound();
  }

  return <AdminOrganizationPage detail={detail} tab={tab} page={page} />;
}
