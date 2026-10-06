import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
        <Badge variant={program.status === "published" ? "success" : "outline"}>
          {program.status === "published" ? t("settings.published") : t("state.draft")}
        </Badge>
      </div>
      <ProgramTabs id={id} current="questions" />
      {/* The editor starts from the questions as they were read; a save reads them again. */}
      <ProgramQuestionsEditor key={questions.version} programId={id} initial={questions} />
    </div>
  );
}
