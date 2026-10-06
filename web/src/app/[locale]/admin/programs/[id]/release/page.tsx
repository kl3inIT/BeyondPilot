import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReleasePage } from "@/features/review/release-page";
import { readRelease } from "@/features/review/review-queries";
import { requireRole } from "@/lib/auth/session";
import { adminProgramReleaseRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/release">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.release" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramReleaseRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/release">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramReleaseRoute(id));

  return <ReleasePage release={await readRelease(id)} />;
}
