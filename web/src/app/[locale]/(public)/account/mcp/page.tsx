import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { McpPage } from "@/features/mcp/mcp-page";
import { readConnectedApps, userServerAddress } from "@/features/mcp/mcp-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/mcp">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Mcp" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function McpRoute({ params }: PageProps<"/[locale]/account/mcp">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.accountMcp);
  const [address, apps] = await Promise.all([userServerAddress(), readConnectedApps()]);

  return <McpPage address={address} apps={apps} />;
}
