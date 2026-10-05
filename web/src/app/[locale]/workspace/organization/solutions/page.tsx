import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { OrganizationSolutionsPage } from "@/features/solution/organization-solutions-page";
import { readMySolutions } from "@/features/solution/solution-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/solutions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Solution.mine" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationSolutionsRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/solutions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceSolutions);
  const [mine, solutions, members] = await Promise.all([
    readMyOrganization(),
    readMySolutions(),
    readMembers(),
  ]);
  const { organization } = mine;
  // Solutions belong to a provider; anyone else is shown their organization's first page.
  if (!organization || !organization.roles.includes("provider")) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }

  return (
    <OrganizationSolutionsPage
      mine={{ ...mine, organization }}
      solutions={solutions}
      members={members?.members.length ?? 0}
    />
  );
}
