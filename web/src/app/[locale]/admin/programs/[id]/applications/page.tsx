import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramTabs } from "@/features/program/program-tabs";
import { ReviewApplicationsPage } from "@/features/review/review-applications-page";
import { readReviewApplications } from "@/features/review/review-queries";
import { loadReviewSearch } from "@/features/review/review-search";
import { requireRole } from "@/lib/auth/session";
import { adminProgramApplicationsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.list" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramApplicationsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/programs/[id]/applications">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramApplicationsRoute(id));
  const [data, search] = await Promise.all([
    readReviewApplications(id),
    loadReviewSearch(searchParams),
  ]);

  return (
    <ReviewApplicationsPage
      data={data}
      search={search}
      base={adminProgramApplicationsRoute(id)}
      tabs={<ProgramTabs id={id} current="applications" applications />}
    />
  );
}
