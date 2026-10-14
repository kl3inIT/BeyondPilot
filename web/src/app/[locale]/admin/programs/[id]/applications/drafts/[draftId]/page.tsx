import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReviewDraftPage } from "@/features/review/review-draft-page";
import { readReviewDraft } from "@/features/review/review-queries";
import { requireRole } from "@/lib/auth/session";
import { adminProgramDraftRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications/drafts/[draftId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Review.drafts.detail" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ReviewDraftRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]/applications/drafts/[draftId]">) {
  const { locale, id, draftId } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminProgramDraftRoute(id, draftId));
  const draft = await readReviewDraft(draftId);
  // A draft is read under its own program's address only.
  if (draft.head.programId !== id) {
    notFound();
  }

  return <ReviewDraftPage draft={draft} />;
}
