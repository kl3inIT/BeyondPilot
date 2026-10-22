import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewApplicationPage } from "@/features/review/review-application-page";
import { readReviewApplication, readReviewApplications } from "@/features/review/review-queries";
import { loadReviewSearch } from "@/features/review/review-search";
import { requireAccount } from "@/lib/auth/session";
import { reviewProgramRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reviews/[programId]/[applicationId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.application" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ReviewApplicationRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/reviews/[programId]/[applicationId]">) {
  const { locale, programId, applicationId } = await params;
  setRequestLocale(locale);
  await requireAccount(`${reviewProgramRoute(programId)}/${applicationId}`);
  const [review, applications, search] = await Promise.all([
    readReviewApplication(applicationId),
    readReviewApplications(programId),
    loadReviewSearch(searchParams),
  ]);

  return (
    <ReviewApplicationPage
      review={review}
      queue={applications.items}
      search={search}
      base={reviewProgramRoute(programId)}
    />
  );
}
