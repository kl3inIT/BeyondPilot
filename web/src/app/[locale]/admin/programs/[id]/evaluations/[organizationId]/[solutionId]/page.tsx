import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EvaluationCandidatePage } from "@/features/matching/evaluation-candidate-page";
import { readEvaluationCandidate } from "@/features/matching/matching-queries";
import { readReviewApplications } from "@/features/review/review-queries";
import { requireRole } from "@/lib/auth/session";
import { adminProgramEvaluationRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/evaluations/[organizationId]/[solutionId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Matching.evaluation" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramEvaluationRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/evaluations/[organizationId]/[solutionId]">) {
  const { locale, id, organizationId, solutionId } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramEvaluationRoute(id, organizationId, solutionId));
  const [detail, applications] = await Promise.all([
    readEvaluationCandidate(id, organizationId, solutionId),
    readReviewApplications(id),
  ]);
  if (!detail) {
    notFound();
  }

  return (
    <EvaluationCandidatePage
      programId={id}
      detail={detail}
      released={Boolean(applications.head.releasedAt)}
    />
  );
}
