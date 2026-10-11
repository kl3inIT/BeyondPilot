import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { SolutionPage } from "@/features/solution/solution-page";
import { readSharedSolution } from "@/features/solution/solution-queries";
import { titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/shared/[viewKey]">): Promise<Metadata> {
  const { viewKey } = await params;
  const solution = await readSharedSolution(viewKey);

  // Shared by link, never found through a search engine.
  return {
    title: solution ? solution.name + titleSuffix : undefined,
    description: solution?.summary ?? undefined,
    robots: { index: false, follow: false },
  };
}

/** A solution read by the key of its shared page, as a proposal links it, whatever its review says. */
export default async function SharedSolutionRoute({
  params,
}: PageProps<"/[locale]/solutions/shared/[viewKey]">) {
  const { locale, viewKey } = await params;
  setRequestLocale(locale);
  const solution = await readSharedSolution(viewKey);
  if (!solution) {
    notFound();
  }

  return <SolutionPage solution={solution} />;
}
