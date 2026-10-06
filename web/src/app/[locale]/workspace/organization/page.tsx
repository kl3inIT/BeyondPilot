import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { OrganizationEntry } from "@/features/organization/organization-entry";
import { OrganizationEntryFrame } from "@/features/organization/organization-entry-frame";
import { OrganizationProfilePage } from "@/features/organization/organization-profile-page";
import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { readUseCaseCount } from "@/features/usecase/my-use-case-queries";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MyOrganizationRoute({
  params,
}: PageProps<"/[locale]/workspace/organization">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceOrganization);
  const mine = await readMyOrganization();
  const { organization } = mine;

  // A person without an organization meets the ways in, on their own frame without the site's navigation.
  if (!organization) {
    return (
      <OrganizationEntryFrame>
        <OrganizationEntry mine={mine} />
      </OrganizationEntryFrame>
    );
  }

  const [members, solutions, useCases] = await Promise.all([
    readMembers(),
    organization.roles.includes("provider") ? readMySolutions() : null,
    readUseCaseCount({ ...mine, organization }),
  ]);
  const counts = {
    members: members?.members.length ?? 0,
    solutions: solutions?.items.length ?? null,
    useCases,
  };

  return (
    <WorkspaceFrame>
      <OrganizationProfilePage mine={{ ...mine, organization }} counts={counts} />
    </WorkspaceFrame>
  );
}
