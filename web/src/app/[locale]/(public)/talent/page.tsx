import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TalentDirectoryPage } from "@/features/talent/talent-directory-page";
import { readMyTalent, readTalent } from "@/features/talent/talent-queries";
import { loadTalentSearch } from "@/features/talent/talent-search";
import { getCurrentAccount } from "@/lib/auth/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/talent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Talent.directory" });

  return { title: t("metaTitle"), description: t("lead") };
}

export default async function TalentRoute({ params, searchParams }: PageProps<"/[locale]/talent">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await loadTalentSearch(searchParams);

  const [talent, account] = await Promise.all([readTalent(search), getCurrentAccount()]);
  const hasProfile = account ? Boolean((await readMyTalent()).profile) : false;

  return <TalentDirectoryPage talent={talent} search={search} hasProfile={hasProfile} />;
}
