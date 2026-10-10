import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMatchingSettings } from "@/features/matching/matching-queries";
import { MatchingSettingsPage } from "@/features/matching/matching-settings";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/matching">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MatchingSettingsRoute({
  params,
}: PageProps<"/[locale]/admin/ai/matching">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiMatching);
  const settings = await readMatchingSettings().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <MatchingSettingsPage settings={settings} />;
}
