import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  readAdminUseCases,
  readUseCaseOrganizations,
} from "@/features/usecase/admin-use-case-queries";
import { AdminUseCasesPage } from "@/features/usecase/admin-use-cases-page";
import { loadAdminUseCasesSearch } from "@/features/usecase/admin-use-cases-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.useCases" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCasesRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/use-cases">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminUseCases);
  const search = await loadAdminUseCasesSearch(searchParams);
  const [useCases, organizations] = await Promise.all([
    readAdminUseCases(search),
    readUseCaseOrganizations(),
  ]).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminUseCasesPage useCases={useCases} organizations={organizations} search={search} />;
}
