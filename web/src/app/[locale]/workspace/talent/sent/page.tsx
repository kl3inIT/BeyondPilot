import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TalentSentPage } from "@/features/talent/talent-sent-page";
import { readSentTalentEnquiries } from "@/features/talent/talent-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/talent/sent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Talent.sent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function TalentSentRoute({
  params,
}: PageProps<"/[locale]/workspace/talent/sent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.talentSent);

  return <TalentSentPage enquiries={await readSentTalentEnquiries()} />;
}
