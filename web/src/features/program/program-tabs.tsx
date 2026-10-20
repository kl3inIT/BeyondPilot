import { getTranslations } from "next-intl/server";

import { PageTabs } from "@/components/composites/page-tabs";
import {
  adminProgramApplicationsRoute,
  adminProgramEvaluationsRoute,
  adminProgramQuestionsRoute,
  adminProgramReviewersRoute,
  adminProgramRoute,
} from "@/lib/site";

/**
 * The screens of one program in the admin: its Settings and its form's questions, and, for a program
 * that takes applications here, its applications, the AI's evaluation of them and its judges. One
 * that takes none has none of these.
 */
async function ProgramTabs({
  id,
  current,
  applications,
}: {
  id: string;
  current: "settings" | "questions" | "applications" | "evaluations" | "reviewers";
  /** Whether the program takes applications on BeyondPilot. */
  applications: boolean;
}) {
  const t = await getTranslations("Admin.programs.tabs");
  const tabs = [
    { key: "settings", href: adminProgramRoute(id) },
    { key: "questions", href: adminProgramQuestionsRoute(id) },
    ...(applications
      ? ([
          { key: "applications", href: adminProgramApplicationsRoute(id) },
          { key: "evaluations", href: adminProgramEvaluationsRoute(id) },
          { key: "reviewers", href: adminProgramReviewersRoute(id) },
        ] as const)
      : []),
  ] as const;
  return (
    <PageTabs
      label={t("label")}
      current={current}
      tabs={tabs.map((tab) => ({ ...tab, label: t(tab.key) }))}
    />
  );
}

export { ProgramTabs };
