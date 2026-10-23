import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LumaAdminPage } from "@/features/program/luma-admin-page";
import { readLumaConnection } from "@/features/program/program-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/luma">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.programs.lumaTab" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function LumaAdminRoute({
  params,
}: PageProps<"/[locale]/admin/programs/luma">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminProgramsLuma);
  const connection = await readLumaConnection();

  return <LumaAdminPage connection={connection} />;
}
