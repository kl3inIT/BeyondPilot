import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApplicationPage } from "@/features/apply/application-page";
import { readMyApplication } from "@/features/apply/apply-queries";
import { requireAccount } from "@/lib/auth/session";
import { myApplicationRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/applications/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Application" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ApplicationRoute({
  params,
}: PageProps<"/[locale]/applications/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(myApplicationRoute(id));

  return <ApplicationPage view={await readMyApplication(id)} />;
}
