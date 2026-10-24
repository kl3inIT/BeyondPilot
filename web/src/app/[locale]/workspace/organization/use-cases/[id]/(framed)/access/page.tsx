import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMyOrganization } from "@/features/organization/organization-queries";
import {
  hasUseCases,
  readMyUseCase,
  readMyUseCaseAccess,
} from "@/features/usecase/my-use-case-queries";
import { WorkspaceUseCaseAccessPage } from "@/features/usecase/use-case-access-page";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes, workspaceUseCaseAccessRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/access">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.useCases.access" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseAccessRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/access">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(workspaceUseCaseAccessRoute(id));
  const { organization } = await readMyOrganization();
  if (!organization || !hasUseCases(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }
  const [useCase, access] = await Promise.all([readMyUseCase(id), readMyUseCaseAccess(id)]);
  if (!useCase || !access) {
    notFound();
  }

  return <WorkspaceUseCaseAccessPage useCase={useCase} access={access} />;
}
