import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminTalentListPage } from "@/features/talent/admin-talent-list-page";
import { readAdminTalentList } from "@/features/talent/talent-queries";
import { loadAdminTalentSearch } from "@/features/talent/talent-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/talent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.talent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminTalentListRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/talent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminTalent);
  const search = await loadAdminTalentSearch(searchParams);
  const talent = await readAdminTalentList(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminTalentListPage talent={talent} search={search} />;
}
