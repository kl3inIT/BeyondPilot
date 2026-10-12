import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SolutionEditor } from "@/features/solution/solution-editor";
import { readAdminSolutionDraft } from "@/features/solution/solution-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/[id]/edit">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.solutions" });
  // Anyone but an operator gets no name.
  const solution = await readAdminSolutionDraft(id).catch(() => null);

  return {
    title: solution ? solution.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminSolutionEditorRoute({
  params,
}: PageProps<"/[locale]/admin/solutions/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminSolutions}/${id}/edit`);
  const solution = await readAdminSolutionDraft(id);
  if (!solution) {
    notFound();
  }

  // One editor per solution: it keeps what is typed while the page reads the backend again.
  return <SolutionEditor key={solution.id} solution={solution} operator />;
}
