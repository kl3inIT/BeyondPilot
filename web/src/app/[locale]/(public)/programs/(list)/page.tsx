import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramsPage } from "@/features/program/programs-page";
import { readPrograms, readProgramSearch } from "@/features/program/program-public-queries";
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
  const search = await loadProgramsPublicSearch(searchParams);
  const [programs, results] = await Promise.all([
    readPrograms(Boolean(search.q.trim())),
    readProgramSearch(search),
  ]);
  const bySlug = new Map(programs.map((program) => [program.slug, program]));
  const ranked = results?.items.map((item) => {
    const program = bySlug.get(item.slug);
    if (!program) throw new Error(`Search returned an unavailable program: ${item.slug}`);
    return program;
  });
  return (
    <ProgramsPage
      groups={groupPrograms(programs, search)}
      search={search}
      results={results}
      ranked={ranked}
    />
  );
}
