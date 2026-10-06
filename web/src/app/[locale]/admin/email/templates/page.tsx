import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readEmailSettings, readEmailTemplates } from "@/features/email/email-queries";
import { EmailTemplatesPage } from "@/features/email/email-templates-page";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/templates">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.templates" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailTemplatesRoute({
  params,
}: PageProps<"/[locale]/admin/email/templates">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminEmailTemplates);
  const [templates, settings] = await Promise.all([readEmailTemplates(), readEmailSettings()]);

  return <EmailTemplatesPage templates={templates} ready={settings.ready} />;
}
