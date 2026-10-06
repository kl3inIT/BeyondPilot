import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { MyUseCasesPage } from "@/features/usecase/my-use-cases-page";
import { hasUseCases, readMyUseCases } from "@/features/usecase/my-use-case-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";
import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.useCases" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCasesRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceUseCases);
  const [mine, members] = await Promise.all([readMyOrganization(), readMembers()]);
  const { organization } = mine;
  // Use cases belong to an approved enterprise; anyone else is shown their organization's first page.
  if (!organization || !hasUseCases(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }
  const [useCases, solutions] = await Promise.all([
    readMyUseCases(),
    organization.roles.includes("provider") ? readMySolutions() : null,
  ]);

  return (
    <WorkspaceFrame>
      <MyUseCasesPage
        mine={{ ...mine, organization }}
        useCases={useCases}
        members={members?.members.length ?? 0}
        solutions={solutions?.items.length ?? null}
      />
    </WorkspaceFrame>
  );
}
