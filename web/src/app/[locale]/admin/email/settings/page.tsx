import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmailHeader } from "@/features/email/email-header";
import { readEmailSettings } from "@/features/email/email-queries";
import { EmailSettingsForm } from "@/features/email/email-settings-form";
import { EmailSetupChecklist } from "@/features/email/email-setup-checklist";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.settings" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailSettingsRoute({
  params,
}: PageProps<"/[locale]/admin/email/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const account = await requireRole("operator", siteRoutes.adminEmailSettings);
  const settings = await readEmailSettings();

  // The form starts from the settings as they were read; a save reads them again.
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 md:px-6 lg:px-8">
      <EmailHeader current="settings" ready={settings.ready} />
      {/* What the provider says can only be asked once a provider and a sender are saved. */}
      {settings.ready && <EmailSetupChecklist key={settings.version} />}
      <EmailSettingsForm key={settings.version} settings={settings} operatorEmail={account.email} />
    </div>
  );
}
