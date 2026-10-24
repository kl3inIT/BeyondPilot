import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readSolutionPerks, readSolutionsWithPerks } from "@/features/perk/perk-queries";
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
  // Solutions do not know their perks: with the perks filter on, the perks name the solutions to list.
  const { solutions, perks } = await readSolutions(
    search,
    search.perks === null || search.q.trim() !== "" ? null : await readSolutionsWithPerks(),
  );

  return (
    <SolutionsPage
      solutions={solutions}
      perks={perks ?? (await readSolutionPerks(solutions.items.map((solution) => solution.slug)))}
      search={search}
    />
  );
}
