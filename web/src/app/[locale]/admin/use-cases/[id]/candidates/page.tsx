import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MatchingPage } from "@/features/matching/matching-page";
import { readMatching } from "@/features/matching/matching-queries";
import { readAdminUseCase } from "@/features/usecase/admin-use-case-queries";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { adminUseCaseCandidatesRoute, siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/candidates">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCaseCandidatesRoute({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/candidates">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminUseCaseCandidatesRoute(id));
  const gone = (error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  };
  const useCase = await readAdminUseCase(id).catch(gone);
  if (!useCase) {
    notFound();
  }
  // Only a use case that was published is matched; before that there is its brief alone.
  if (!useCase.publishedAt) {
    redirect(getPathname({ href: `${siteRoutes.adminUseCases}/${id}`, locale }));
  }
  const matching = await readMatching(id).catch(gone);
  if (!matching) {
    notFound();
  }

  return (
    <MatchingPage
      area="admin"
      useCase={{ ...useCase, organizationName: useCase.organization.name }}
      matching={matching}
    />
  );
}
