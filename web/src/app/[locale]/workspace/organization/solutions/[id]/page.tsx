import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SolutionEditorPage } from "@/features/solution/solution-editor-page";
import { readMySolution, readMySolutions } from "@/features/solution/solution-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/solutions/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Solution.mine" });
  const solution = await readMySolution(id).catch(() => null);

  return {
    title: solution ? solution.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function SolutionEditorRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/solutions/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${siteRoutes.workspaceSolutions}/${id}`);
  const [solution, solutions] = await Promise.all([readMySolution(id), readMySolutions()]);
  if (!solution) {
    notFound();
  }

  return <SolutionEditorPage solution={solution} editable={solutions.editable} />;
}
