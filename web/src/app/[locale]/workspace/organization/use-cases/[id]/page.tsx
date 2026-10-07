import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMyOrganization } from "@/features/organization/organization-queries";
import { hasUseCases, readMyUseCase } from "@/features/usecase/my-use-case-queries";
import { UseCaseView } from "@/features/usecase/use-case-view";
import { UseCaseWizard } from "@/features/usecase/use-case-wizard";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.useCases" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${siteRoutes.workspaceUseCases}/${id}`);
  const { organization } = await readMyOrganization();
  if (!organization || !hasUseCases(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }
  const useCase = await readMyUseCase(id);
  if (!useCase) {
    notFound();
  }

  // The key makes a newer version, read after a conflict or a change of status, start the page afresh.
  return useCase.editable ? (
    <UseCaseWizard key={`${useCase.version}-${useCase.status}`} useCase={useCase} />
  ) : (
    <UseCaseView key={`${useCase.version}-${useCase.status}`} useCase={useCase} />
  );
}
