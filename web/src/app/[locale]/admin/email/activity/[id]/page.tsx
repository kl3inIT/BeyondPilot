import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmailMessagePage } from "@/features/email/email-message-page";
import { readEmailMessage } from "@/features/email/email-queries";
import { requireRole } from "@/lib/auth/session";
import { adminEmailMessageRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/email/activity/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.email.message" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EmailMessageRoute({
  params,
}: PageProps<"/[locale]/admin/email/activity/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminEmailMessageRoute(id));
  const message = await readEmailMessage(id);

  return <EmailMessagePage message={message} />;
}
