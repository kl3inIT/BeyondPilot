import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminSolutionPage } from "@/features/solution/admin-solution-page";
import { readAdminSolution, readAdminSolutions } from "@/features/solution/solution-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/solutions/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.solutions" });

  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const record = await readAdminSolution(id).catch(() => null);

  return {
    title: record ? record.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminSolutionRoute({
  params,
}: PageProps<"/[locale]/admin/solutions/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminSolutions}/${id}`);
  const solution = await readAdminSolution(id);
  if (!solution) {
    notFound();
  }

  const waiting = await readAdminSolutions({
    q: "",
    status: "submitted",
    industry: null,
    page: 1,
  });
  // The queue is walked in its order: the record after this one, or its first when this is the last.
  const at = waiting.items.findIndex((item) => item.id === id);
  const other = waiting.items[at + 1] ?? waiting.items.find((item) => item.id !== id);
  const next = other
    ? { href: `${siteRoutes.adminSolutions}/${other.id}`, name: other.name }
    : null;

  const queue = { place: at >= 0 ? at + 1 : null, total: waiting.total };

  return <AdminSolutionPage solution={solution} next={next} queue={queue} />;
}
