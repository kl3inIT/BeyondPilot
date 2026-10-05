import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminSolutionsPage } from "@/features/solution/admin-solutions-page";
import { readAdminSolutions } from "@/features/solution/solution-queries";
import { loadAdminSolutionsSearch } from "@/features/solution/solutions-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.solutions" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminSolutionsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/solutions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminSolutions);
  const search = await loadAdminSolutionsSearch(searchParams);
  const solutions = await readAdminSolutions(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminSolutionsPage solutions={solutions} search={search} />;
}
