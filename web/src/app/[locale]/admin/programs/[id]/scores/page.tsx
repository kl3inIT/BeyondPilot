import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { readAdminProgram } from "@/features/program/program-queries";
import { ProgramTabs } from "@/features/program/program-tabs";
import { ProgramScoresPage } from "@/features/review/program-scores-page";
import { readProgramScores } from "@/features/review/review-queries";
import { loadScoresSearch } from "@/features/review/scores-search";
import { requireRole } from "@/lib/auth/session";
import { adminProgramScoresRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/scores">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.scores" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramScoresRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/programs/[id]/scores">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramScoresRoute(id));
  const [program, scores, t, search] = await Promise.all([
    readAdminProgram(id),
    readProgramScores(id),
    getTranslations("Admin.programs"),
    loadScoresSearch(searchParams),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        title={program.name}
        badges={
          <Badge variant={program.status === "published" ? "success" : "outline"}>
            {program.status === "published" ? t("settings.published") : t("state.draft")}
          </Badge>
        }
      >
        <ProgramTabs id={id} current="scores" applications />
      </AdminPageHeader>
      <ProgramScoresPage programId={id} data={scores} search={search} />
    </div>
  );
}
