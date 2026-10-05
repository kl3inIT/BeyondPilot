import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OrganizationMembersPage } from "@/features/organization/organization-members-page";
import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.members" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationMembersRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/members">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceMembers);
  const [mine, members] = await Promise.all([readMyOrganization(), readMembers()]);
  const { organization } = mine;
  // A person without an organization has no members to read; the first page offers the ways in.
  if (!organization || !members) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }

  const solutions = organization.roles.includes("provider") ? await readMySolutions() : null;

  return (
    <OrganizationMembersPage
      mine={{ ...mine, organization }}
      members={members}
      solutions={solutions?.items.length ?? null}
    />
  );
}
