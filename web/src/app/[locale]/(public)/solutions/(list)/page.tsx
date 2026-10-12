import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readSolutions } from "@/features/solution/solution-queries";
import { SolutionsPage } from "@/features/solution/solutions-page";
import { loadSolutionsSearch } from "@/features/solution/solutions-search";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Solution.directory" });

  return { title: t("metaTitle"), description: t("lead") };
}

export default async function SolutionsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/solutions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await loadSolutionsSearch(searchParams);

  return <SolutionsPage solutions={await readSolutions(search)} search={search} />;
}
