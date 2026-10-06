import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readEmailSettings, readEmailSuppressions } from "@/features/email/email-queries";
import { loadEmailSuppressionsSearch } from "@/features/email/email-search";
import { EmailSuppressionsPage } from "@/features/email/email-suppressions-page";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/suppressions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.suppressions" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailSuppressionsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/email/suppressions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminEmailSuppressions);
  const search = await loadEmailSuppressionsSearch(searchParams);
  const [suppressions, settings] = await Promise.all([
    readEmailSuppressions(search),
    readEmailSettings(),
  ]);

  return (
    <EmailSuppressionsPage suppressions={suppressions} search={search} ready={settings.ready} />
  );
}
