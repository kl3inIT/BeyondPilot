import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readChatSettings } from "@/features/ai/chat-queries";
import { ChatTab } from "@/features/ai/chat-tab";
import { ProvidersShell, providersTab } from "@/features/ai/providers-shell";
import { readAiProviders } from "@/features/search/admin-ai-queries";
import { EmbeddingTab } from "@/features/search/ai-providers-page";
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

/** The role was withdrawn, or the session ended, between the role check and the read. */
function gone(error: unknown): never {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    notFound();
  }
  throw error;
}

export default async function AiProvidersRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/ai/providers">) {
  const [{ locale }, { tab: asked }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminAiProviders);
  const tab = providersTab(asked);

  return (
    <ProvidersShell tab={tab}>
      {tab === "chat" ? (
        <ChatTab data={await readChatSettings().catch(gone)} />
      ) : (
        <EmbeddingTab data={await readAiProviders().catch(gone)} />
      )}
    </ProvidersShell>
  );
}
