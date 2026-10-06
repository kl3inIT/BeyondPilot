import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { loadAdminIntroductionsSearch } from "@/features/introduction/admin-introductions-search";
import { AdminIntroductionsPage } from "@/features/introduction/admin-introductions-page";
import { readAdminIntroductions } from "@/features/introduction/introduction-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/introductions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.introductions" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminIntroductionsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/introductions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminIntroductions);
  const search = await loadAdminIntroductionsSearch(searchParams);
  const introductions = await readAdminIntroductions(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AdminIntroductionsPage introductions={introductions} search={search} />;
}
