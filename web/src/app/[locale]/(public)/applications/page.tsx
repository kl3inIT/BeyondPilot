import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMyApplications } from "@/features/apply/apply-queries";
import { MyApplicationsPage } from "@/features/apply/my-applications-page";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/applications">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MyApplications" });

  return { title: t("title"), robots: { index: false } };
}

export default async function MyApplicationsRoute({ params }: PageProps<"/[locale]/applications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.myApplications);

  return <MyApplicationsPage list={await readMyApplications()} />;
}
