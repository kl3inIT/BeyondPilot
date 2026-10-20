import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { EvaluationBoard } from "@/features/matching/evaluation-board";
import { readEvaluationBoard } from "@/features/matching/matching-queries";
import { ProgramTabs } from "@/features/program/program-tabs";
import { readReviewApplications } from "@/features/review/review-queries";
import { requireRole } from "@/lib/auth/session";
import { adminProgramEvaluationsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/evaluations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Matching.evaluation" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramEvaluationsRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/evaluations">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramEvaluationsRoute(id));
  const [board, applications, t] = await Promise.all([
    readEvaluationBoard(id),
    readReviewApplications(id),
    getTranslations("Matching.evaluation"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader title={applications.head.name} lead={t("about")}>
        <ProgramTabs id={id} current="evaluations" applications />
      </AdminPageHeader>
      <EvaluationBoard board={board} released={Boolean(applications.head.releasedAt)} />
    </div>
  );
}
