import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewApplicationPage } from "@/features/review/review-application-page";
import { readReviewApplication, readReviewApplications } from "@/features/review/review-queries";
import { loadReviewSearch } from "@/features/review/review-search";
import { requireRole } from "@/lib/auth/session";
import { adminProgramApplicationsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications/[applicationId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.application" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramApplicationRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/programs/[id]/applications/[applicationId]">) {
  const { locale, id, applicationId } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${adminProgramApplicationsRoute(id)}/${applicationId}`);
  const [review, applications, search] = await Promise.all([
    readReviewApplication(applicationId),
    readReviewApplications(id),
    loadReviewSearch(searchParams),
  ]);

  return (
    <ReviewApplicationPage
      review={review}
      queue={applications.items}
      search={search}
      base={adminProgramApplicationsRoute(id)}
    />
  );
}
