import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMatchingRun } from "@/features/matching/matching-queries";
import { MatchingRunPage } from "@/features/matching/matching-run-page";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { adminAiMatchingRunRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/matching/runs/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MatchingRunRoute({
  params,
}: PageProps<"/[locale]/admin/ai/matching/runs/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminAiMatchingRunRoute(id));
  const detail = await readMatchingRun(id).catch((error: unknown) => {
    // An address that is not a run's, or the role withdrawn or the session ended since the check above.
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 401 || error.status === 403)
    ) {
      notFound();
    }
    throw error;
  });
  if (!detail) {
    notFound();
  }

  return <MatchingRunPage detail={detail} />;
}
