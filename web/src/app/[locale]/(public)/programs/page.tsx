import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramsPage } from "@/features/program/programs-page";
import { readPrograms } from "@/features/program/program-public-queries";
import { groupPrograms, loadProgramsPublicSearch } from "@/features/program/programs-public-search";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/programs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Programs" });

  return { title: t("metaTitle"), description: t("lead") };
}

export default async function ProgramsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/programs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [programs, search] = await Promise.all([
    readPrograms(),
    loadProgramsPublicSearch(searchParams),
  ]);

  return <ProgramsPage groups={groupPrograms(programs, search)} />;
}
