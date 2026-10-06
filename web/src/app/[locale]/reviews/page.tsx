import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MyReviewsPage } from "@/features/review/my-reviews-page";
import { readReviewPrograms } from "@/features/review/review-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reviews">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.programs" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ReviewsRoute({ params }: PageProps<"/[locale]/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.reviews);

  return <MyReviewsPage programs={await readReviewPrograms()} />;
}
