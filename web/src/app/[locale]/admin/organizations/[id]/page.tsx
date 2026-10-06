import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminOrganizationPage } from "@/features/organization/admin-organization-page";
import { readAdminOrganization } from "@/features/organization/organization-queries";
import { readAdminSolutions } from "@/features/solution/solution-queries";
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
}: PageProps<"/[locale]/admin/organizations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminOrganizations}/${id}`);
  const detail = await readAdminOrganization(id);
  if (!detail) {
    notFound();
  }

  // Only a provider has solutions; its Solutions tab says how many it has sent for review.
  const solutions = detail.organization.roles.includes("provider")
    ? (await readAdminSolutions({ q: "", status: null, industry: null, page: 1 }, id)).total
    : null;

  return <AdminOrganizationPage detail={detail} solutions={solutions} />;
}
