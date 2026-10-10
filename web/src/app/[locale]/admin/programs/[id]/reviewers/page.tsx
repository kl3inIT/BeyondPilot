import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { readAdminProgram } from "@/features/program/program-queries";
import { ProgramTabs } from "@/features/program/program-tabs";
import { readReviewCriteria, readReviewers } from "@/features/review/review-queries";
import { ReviewersPage } from "@/features/review/reviewers-page";
import { requireRole } from "@/lib/auth/session";
import { adminProgramReviewersRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/reviewers">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.reviewers" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramReviewersRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/reviewers">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramReviewersRoute(id));
  const [program, reviewers, criteria, t] = await Promise.all([
    readAdminProgram(id),
    readReviewers(id),
    readReviewCriteria(id),
    getTranslations("Admin.programs"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
        <Badge variant={program.status === "published" ? "success" : "outline"}>
          {program.status === "published" ? t("settings.published") : t("state.draft")}
        </Badge>
      </div>
      <ProgramTabs id={id} current="reviewers" applications />
      <ReviewersPage
        programId={id}
        programName={program.name}
        reviewers={reviewers}
        criteria={criteria}
      />
    </div>
  );
}
