import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { ProgramQuestionsEditor } from "@/features/program/program-questions";
import { readAdminProgram, readProgramQuestions } from "@/features/program/program-queries";
import { ProgramTabs } from "@/features/program/program-tabs";
import { requireRole } from "@/lib/auth/session";
import { adminProgramQuestionsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/questions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.programs.questions" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramQuestionsRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/questions">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramQuestionsRoute(id));
  const [program, questions, t] = await Promise.all([
    readAdminProgram(id),
    readProgramQuestions(id),
    getTranslations("Admin.programs"),
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
        <ProgramTabs id={id} current="questions" applications={Boolean(program.applications)} />
      </AdminPageHeader>
      {/* The editor starts from the questions as they were read; a save reads them again. */}
      <ProgramQuestionsEditor key={questions.version} programId={id} initial={questions} />
    </div>
  );
}
