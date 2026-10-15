import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMatchingRuns } from "@/features/matching/matching-queries";
import { MatchingRunsPage } from "@/features/matching/matching-runs-page";
import { loadMatchingRunsSearch } from "@/features/matching/matching-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/matching/runs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MatchingRunsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/ai/matching/runs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiMatchingRuns);
  const { page, size } = await loadMatchingRunsSearch(searchParams);
  const runs = await readMatchingRuns(Math.max(1, page), size).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <MatchingRunsPage runs={runs} size={size} />;
}
