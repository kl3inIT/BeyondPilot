import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProgramTabs } from "@/features/program/program-tabs";
import { ProgramDraftsPage } from "@/features/review/program-drafts-page";
import { readProgramDrafts, readReviewApplications } from "@/features/review/review-queries";
import { requireRole } from "@/lib/auth/session";
import { adminProgramDraftsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications/drafts">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.drafts" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProgramDraftsRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications/drafts">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramDraftsRoute(id));
  const [applications, drafts] = await Promise.all([
    readReviewApplications(id),
    readProgramDrafts(id),
  ]);

  return (
    <ProgramDraftsPage
      head={applications.head}
      drafts={drafts}
      tabs={<ProgramTabs id={id} current="applications" applications />}
    />
  );
}
