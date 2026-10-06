import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readSearchIndex } from "@/features/search/admin-ai-queries";
import { SearchIndexPage } from "@/features/search/search-index-page";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/search-index">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.searchIndex" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SearchIndexRoute({
  params,
}: PageProps<"/[locale]/admin/ai/search-index">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminSearchIndex);
  const data = await readSearchIndex().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <SearchIndexPage data={data} />;
}
