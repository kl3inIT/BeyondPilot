import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readAdminOrganization } from "@/features/organization/organization-queries";
import { AdminOrganizationSolutionsPage } from "@/features/solution/admin-organization-solutions-page";
import { readAdminSolution, readAdminSolutions } from "@/features/solution/solution-queries";
import { loadAdminOrganizationSolutionsSearch } from "@/features/solution/solutions-search";
import { requireRole } from "@/lib/auth/session";
import { adminOrganizationSolutionsRoute, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/organizations/[id]/solutions">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.organizations" });

  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const record = await readAdminOrganization(id).catch(() => null);

  return {
    title: record ? record.organization.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminOrganizationSolutionsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/organizations/[id]/solutions">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminOrganizationSolutionsRoute(id));
  const detail = await readAdminOrganization(id);
  // Only a provider has solutions; any other organization has no such tab.
  if (!detail || !detail.organization.roles.includes("provider")) {
    notFound();
  }

  const { solution } = await loadAdminOrganizationSolutionsSearch(searchParams);
  const solutions = await readAdminSolutions({ q: "", status: null, industry: null, page: 1 }, id);
  // The solution the address names, or the first of the list: the one that has waited longest.
  const open = solutions.items.find((item) => item.id === solution) ?? solutions.items[0];
  const selected = open ? await readAdminSolution(open.id) : null;

  return (
    <AdminOrganizationSolutionsPage detail={detail} solutions={solutions} selected={selected} />
  );
}
