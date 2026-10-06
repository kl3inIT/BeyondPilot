import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmailAppearanceForm } from "@/features/email/email-appearance-form";
import { readEmailSettings, readEmailTemplate } from "@/features/email/email-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/appearance">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.appearance" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailAppearanceRoute({
  params,
}: PageProps<"/[locale]/admin/email/appearance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminEmailAppearance);
  const [settings, sample] = await Promise.all([
    readEmailSettings(),
    readEmailTemplate("organization_approved"),
  ]);

  return (
    <EmailAppearanceForm
      key={settings.version}
      settings={settings}
      sample={{ subject: sample.subject, body: sample.body }}
    />
  );
}
