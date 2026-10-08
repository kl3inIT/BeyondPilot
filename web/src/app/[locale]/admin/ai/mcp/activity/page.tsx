import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { McpActivityPage } from "@/features/mcp/admin-mcp-activity";
import { loadMcpActivitySearch } from "@/features/mcp/admin-mcp-search";
import { readEveryConnection, readMcpCalls, readMcpSettings } from "@/features/mcp/mcp-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/mcp/activity">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.mcp" });

  return { title: t("metaActivity"), robots: { index: false } };
}

export default async function McpActivityRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/ai/mcp/activity">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminMcpActivity);
  const search = await loadMcpActivitySearch(searchParams);
  const [settings, apps, calls] = await Promise.all([
    readMcpSettings(),
    readEveryConnection(),
    readMcpCalls(search),
  ]).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });
  const counts = { tools: settings.tools.length, apps: apps.length };

  return <McpActivityPage calls={calls} search={search} counts={counts} />;
}
