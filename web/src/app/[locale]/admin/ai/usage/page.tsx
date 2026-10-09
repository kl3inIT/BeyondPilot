import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { UsageOverviewPage } from "@/features/ai/usage-page";
import { readUsageOverview } from "@/features/ai/usage-queries";
import { loadUsageOverviewSearch } from "@/features/ai/usage-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/usage">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.aiUsage" });

  return { title: t("metaOverview"), robots: { index: false } };
}

export default async function AiUsageRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/ai/usage">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiUsage);
  const search = await loadUsageOverviewSearch(searchParams);
  const overview = await readUsageOverview(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <UsageOverviewPage overview={overview} search={search} />;
}
