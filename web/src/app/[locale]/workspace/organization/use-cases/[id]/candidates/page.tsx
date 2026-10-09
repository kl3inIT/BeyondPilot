import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { MatchingPage } from "@/features/matching/matching-page";
import { readMatching } from "@/features/matching/matching-queries";
import { readMyOrganization } from "@/features/organization/organization-queries";
import { hasUseCases, readMyUseCase } from "@/features/usecase/my-use-case-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes, workspaceUseCaseCandidatesRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/candidates">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Matching" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseCandidatesRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/candidates">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(workspaceUseCaseCandidatesRoute(id));
  const { organization } = await readMyOrganization();
  if (!organization || !hasUseCases(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }
  const useCase = await readMyUseCase(id);
  if (!useCase) {
    notFound();
  }
  // Only a use case that was published is matched; before that there is its brief alone.
  if (!useCase.publishedAt) {
    redirect(getPathname({ href: `${siteRoutes.workspaceUseCases}/${id}`, locale }));
  }
  const matching = await readMatching(id);
  if (!matching) {
    notFound();
  }

  return (
    <WorkspaceFrame>
      <MatchingPage area="workspace" useCase={useCase} matching={matching} />
    </WorkspaceFrame>
  );
}
