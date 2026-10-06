import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewApplicationPage } from "@/features/review/review-application-page";
import { readReviewApplication } from "@/features/review/review-queries";
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
}: PageProps<"/[locale]/reviews/[programId]/[applicationId]">) {
  const { locale, programId, applicationId } = await params;
  setRequestLocale(locale);
  await requireAccount(`${reviewProgramRoute(programId)}/${applicationId}`);
  const review = await readReviewApplication(applicationId);

  return <ReviewApplicationPage review={review} base={reviewProgramRoute(programId)} />;
}
