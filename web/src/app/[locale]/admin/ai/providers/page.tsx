import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readAiProviders } from "@/features/search/admin-ai-queries";
import { AiProvidersPage } from "@/features/search/ai-providers-page";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/providers">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.ai.providers" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AiProvidersRoute({
  params,
}: PageProps<"/[locale]/admin/ai/providers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiProviders);
  const data = await readAiProviders().catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AiProvidersPage data={data} />;
}
