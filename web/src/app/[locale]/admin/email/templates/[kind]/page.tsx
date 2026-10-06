import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { isEmailKind } from "@/features/email/email-kinds";
import { readEmailTemplate } from "@/features/email/email-queries";
import { EmailTemplateEditor } from "@/features/email/email-template-editor";
import { requireRole } from "@/lib/auth/session";
import { adminEmailTemplateRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/templates/[kind]">): Promise<Metadata> {
  const { locale, kind } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email" });

  return {
    title: isEmailKind(kind) ? t(`kinds.${kind}.name`) : t("templates.metaTitle"),
    robots: { index: false },
  };
}

export default async function EmailTemplateRoute({
  params,
}: PageProps<"/[locale]/admin/email/templates/[kind]">) {
  const { locale, kind } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminEmailTemplateRoute(kind));
  if (!isEmailKind(kind)) {
    notFound();
  }
  const [template, t] = await Promise.all([
    readEmailTemplate(kind),
    getTranslations("Admin.email"),
  ]);

  // The editor starts from the wording as it was read; a save or a reset reads it again.
  return (
    <EmailTemplateEditor
      key={template.version ?? 0}
      template={template}
      name={t(`kinds.${kind}.name`)}
      description={t(`kinds.${kind}.description`)}
    />
  );
}
