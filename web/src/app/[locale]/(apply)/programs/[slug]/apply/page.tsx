import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApplyFlow } from "@/features/apply/apply-flow";
import { readApplicationForm } from "@/features/apply/apply-queries";
import { requireAccount } from "@/lib/auth/session";
import { programRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/programs/[slug]/apply">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Apply" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/** Applying to a program. Signing in comes first and returns here. */
export default async function ApplyRoute({ params }: PageProps<"/[locale]/programs/[slug]/apply">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const account = await requireAccount(`${programRoute(slug)}/apply`);
  const view = await readApplicationForm(slug);

  return <ApplyFlow initial={view} account={account} />;
}
