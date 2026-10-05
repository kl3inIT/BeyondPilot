import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminOrganizationsPage } from "@/features/organization/admin-organizations-page";
import { loadAdminOrganizationsSearch } from "@/features/organization/admin-organizations-search";
import { readAdminOrganizations } from "@/features/organization/organization-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/organizations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.organizations" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminOrganizationsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/organizations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminOrganizations);
  const search = await loadAdminOrganizationsSearch(searchParams);
  const organizations = await readAdminOrganizations(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminOrganizationsPage organizations={organizations} search={search} />;
}
