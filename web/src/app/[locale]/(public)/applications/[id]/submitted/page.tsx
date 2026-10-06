import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApplicationReceipt } from "@/features/apply/application-receipt";
import { readMyApplication } from "@/features/apply/apply-queries";
import { requireAccount } from "@/lib/auth/session";
import { myApplicationRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/applications/[id]/submitted">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Application.receipt" });

  return { title: t("title"), robots: { index: false } };
}

export default async function ApplicationReceiptRoute({
  params,
}: PageProps<"/[locale]/applications/[id]/submitted">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${myApplicationRoute(id)}/submitted`);

  return <ApplicationReceipt view={await readMyApplication(id)} />;
}
