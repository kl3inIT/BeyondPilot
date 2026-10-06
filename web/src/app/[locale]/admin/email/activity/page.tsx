import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createSerializer } from "nuqs/server";

import { EmailActivityPage } from "@/features/email/email-activity-page";
import { readEmailActivity, readEmailSettings } from "@/features/email/email-queries";
import { emailActivitySearch, loadEmailActivitySearch } from "@/features/email/email-search";
import { getPathname } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

const address = createSerializer(emailActivitySearch);

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/activity">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.activity" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailActivityRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/email/activity">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminEmailActivity);
  const search = await loadEmailActivitySearch(searchParams);
  const paged = search.before !== null || search.after !== null;
  const [messages, settings] = await Promise.all([readEmailActivity(search), readEmailSettings()]);
  // A page beyond either end holds nothing and names no neighbour, so it would be a dead end.
  if (paged && messages.items.length === 0) {
    redirect(
      getPathname({
        href: address(siteRoutes.adminEmailActivity, { ...search, before: null, after: null }),
        locale,
      }),
    );
  }

  return <EmailActivityPage messages={messages} search={search} ready={settings.ready} />;
}
