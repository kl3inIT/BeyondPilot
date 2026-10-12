"use client";

import { useTranslations } from "next-intl";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";
import { siteRoutes } from "@/lib/site";

// The editor of a solution fills the screen and has no site header, so its failure offers the way
// back to the list.
export default function SolutionEditorErrorPage(props: Omit<ErrorNoticeProps, "back">) {
  const t = useTranslations("Error");

  return (
    <main className="flex flex-1 flex-col">
      <ErrorNotice
        {...props}
        back={{ href: siteRoutes.workspaceSolutions, label: t("backToSolutions") }}
      />
    </main>
  );
}
