import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { McpSetupPage } from "@/features/mcp/admin-mcp-pages";
import { readAppHosts, readMcpSettings } from "@/features/mcp/mcp-queries";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/ai/mcp">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.mcp" });

  return { title: t("metaSetup"), robots: { index: false } };
}

export default async function McpSetupRoute({ params }: PageProps<"/[locale]/admin/ai/mcp">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminMcp);
  const data = await Promise.all([readMcpSettings(), readAppHosts()]).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <McpSetupPage settings={data[0]} hosts={data[1]} />;
}
