import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { McpToolsPage } from "@/features/mcp/admin-mcp-pages";
import { readEveryConnection, readMcpSettings } from "@/features/mcp/mcp-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/mcp/tools">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.mcp" });

  return { title: t("metaTools"), robots: { index: false } };
}

export default async function McpToolsRoute({ params }: PageProps<"/[locale]/admin/ai/mcp/tools">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminMcpTools);
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

  return <McpToolsPage settings={settings} counts={counts} />;
}
