import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { readMyOrganization } from "@/features/organization/organization-queries";
import { hasUseCases, readMyUseCase } from "@/features/usecase/my-use-case-queries";
import { UseCaseSentPage } from "@/features/usecase/use-case-sent-page";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/sent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.useCases.sent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseSentRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/sent">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${siteRoutes.workspaceUseCases}/${id}/sent`);
  const { organization } = await readMyOrganization();
  if (!organization || !hasUseCases(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }
  const useCase = await readMyUseCase(id);
  if (!useCase) {
    notFound();
  }
  // Only a use case that was just sent has this page; any other opens where it stands.
  if (useCase.status !== "in_review") {
    redirect(getPathname({ href: `${siteRoutes.workspaceUseCases}/${id}`, locale }));
  }

  return (
    <WorkspaceFrame>
      <UseCaseSentPage useCase={useCase} />
    </WorkspaceFrame>
  );
}
