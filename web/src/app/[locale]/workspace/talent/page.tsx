import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MyTalentPage } from "@/features/talent/my-talent-page";
import { readMyTalent } from "@/features/talent/talent-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/talent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Talent.mine" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MyTalentRoute({ params }: PageProps<"/[locale]/workspace/talent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const account = await requireAccount(siteRoutes.talentProfile);

  return <MyTalentPage mine={await readMyTalent()} accountName={account.displayName ?? ""} />;
}
