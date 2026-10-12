"use client";

import { useTranslations } from "next-intl";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";
import { siteRoutes } from "@/lib/site";

// The editor of a use case fills the screen and has no site header, so its failure offers the way
// back to the list. The pages of the `(framed)` group have an error page of their own, in the frame.
export default function UseCaseEditorErrorPage(props: Omit<ErrorNoticeProps, "back">) {
  const t = useTranslations("Error");

  return (
    <main className="flex flex-1 flex-col">
      <ErrorNotice
        {...props}
        back={{ href: siteRoutes.workspaceUseCases, label: t("backToUseCases") }}
      />
    </main>
  );
}
