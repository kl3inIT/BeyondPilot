import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { McpAppsPage } from "@/features/mcp/admin-mcp-activity";
import { readEveryConnection, readMcpSettings } from "@/features/mcp/mcp-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/mcp/apps">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.mcp" });

  return { title: t("metaApps"), robots: { index: false } };
}

export default async function McpAppsRoute({ params }: PageProps<"/[locale]/admin/ai/mcp/apps">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminMcpApps);
  const [settings, apps] = await Promise.all([readMcpSettings(), readEveryConnection()]).catch(
    (error: unknown) => {
      // The role was withdrawn, or the session ended, between the check above and this read.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        notFound();
      }
      throw error;
    },
  );
  const counts = { tools: settings.tools.length, apps: apps.length };

  return <McpAppsPage apps={apps} counts={counts} />;
}
