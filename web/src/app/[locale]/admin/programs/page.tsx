import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramsAdminPage } from "@/features/program/programs-admin-page";
import { readAdminPrograms } from "@/features/program/program-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.programs" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramsAdminRoute({
  params,
}: PageProps<"/[locale]/admin/programs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminPrograms);
  const programs = await readAdminPrograms();

  return <ProgramsAdminPage programs={programs} />;
}
