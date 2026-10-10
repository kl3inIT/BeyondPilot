import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MatchingFeedbackPage } from "@/features/matching/matching-feedback-list";
import { readMatchingFeedback } from "@/features/matching/matching-queries";
import { loadMatchingFeedbackSearch } from "@/features/matching/matching-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/matching/feedback">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MatchingFeedbackRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/ai/matching/feedback">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiMatchingFeedback);
  const { page } = await loadMatchingFeedbackSearch(searchParams);
  const feedback = await readMatchingFeedback(Math.max(1, page)).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <MatchingFeedbackPage feedback={feedback} />;
}
