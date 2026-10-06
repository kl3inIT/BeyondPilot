import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewApplicationsPage } from "@/features/review/review-applications-page";
import { readReviewApplications } from "@/features/review/review-queries";
import { loadReviewSearch } from "@/features/review/review-search";
import { requireAccount } from "@/lib/auth/session";
import { reviewProgramRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reviews/[programId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.list" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ReviewProgramRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/reviews/[programId]">) {
  const { locale, programId } = await params;
  setRequestLocale(locale);
  await requireAccount(reviewProgramRoute(programId));
  const [data, search] = await Promise.all([
    readReviewApplications(programId),
    loadReviewSearch(searchParams),
  ]);

  return (
    <ReviewApplicationsPage data={data} search={search} base={reviewProgramRoute(programId)} />
  );
}
