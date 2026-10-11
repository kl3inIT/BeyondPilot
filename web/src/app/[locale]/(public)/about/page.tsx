import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Team } from "@/components/sections/team/team";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutRoute({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <Team />;
}
