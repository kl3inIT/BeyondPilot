import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { loadReceivedSearch } from "@/features/proposal/received-search";
import { AdminProposalsPage } from "@/features/proposal/admin-proposals-page";
import { readReceivedProposals } from "@/features/proposal/received-queries";
import { readAdminUseCase } from "@/features/usecase/admin-use-case-queries";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { adminUseCaseProposalsRoute, siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/proposals">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.received.admin" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCaseProposalsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/use-cases/[id]/proposals">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminUseCaseProposalsRoute(id));
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
  // Only a use case that was published takes proposals; before that there is its brief alone.
  if (!useCase.publishedAt) {
    redirect(getPathname({ href: `${siteRoutes.adminUseCases}/${id}`, locale }));
  }
  const [proposals, search] = await Promise.all([
    readReceivedProposals(id).catch(gone),
    loadReceivedSearch(searchParams),
  ]);
  if (!proposals) {
    notFound();
  }

  return (
    <AdminProposalsPage
      useCase={{ ...useCase, organizationName: useCase.organization.name }}
      proposals={proposals}
      tab={search.tab}
    />
  );
}
