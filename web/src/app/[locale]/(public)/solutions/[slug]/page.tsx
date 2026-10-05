import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { SolutionPage } from "@/features/solution/solution-page";
import { readMySolutions, readSolution } from "@/features/solution/solution-queries";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const solution = await readSolution(slug);

  return solution
    ? { title: solution.name + titleSuffix, description: solution.summary ?? undefined }
    : { robots: { index: false } };
}

export default async function SolutionRoute({ params }: PageProps<"/[locale]/solutions/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const solution = await readSolution(slug);
  if (!solution) {
    notFound();
  }

  const mine = (await getCurrentAccount()) ? await readMySolutions().catch(() => null) : null;
  const own = mine?.editable ? mine.items.find((item) => item.slug === slug) : undefined;

  return (
    <SolutionPage
      solution={solution}
      editHref={own && `${siteRoutes.workspaceSolutions}/${own.id}`}
    />
  );
}
