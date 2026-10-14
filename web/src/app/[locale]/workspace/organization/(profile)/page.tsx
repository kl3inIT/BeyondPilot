import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "next/navigation";

import { isIndividual } from "@/features/organization/organization-codes";
import { OrganizationEntry } from "@/features/organization/organization-entry";
import { OrganizationEntryFrame } from "@/features/organization/organization-entry-frame";
import { OrganizationProfilePage } from "@/features/organization/organization-profile-page";
import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { readUseCaseCount } from "@/features/usecase/my-use-case-queries";
import { getPathname } from "@/i18n/navigation";
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
  searchParams,
}: PageProps<"/[locale]/workspace/organization">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceOrganization);
  const mine = await readMyOrganization();
  const { organization } = mine;

  // A person without an organization meets the ways in, under the site's header like every other page.
  if (!organization) {
    return (
      <OrganizationEntryFrame>
        <OrganizationEntry mine={mine} finding={(await searchParams).find !== undefined} />
      </OrganizationEntryFrame>
    );
  }

  // A person on their own has no profile or members of an organization: their page is their solutions.
  if (isIndividual(organization)) {
    redirect(getPathname({ href: siteRoutes.workspaceSolutions, locale }));
  }

  const [members, solutions, useCases] = await Promise.all([
    readMembers(),
    readMySolutions(),
    readUseCaseCount({ ...mine, organization }),
  ]);
  const counts = {
    members: members?.total ?? 0,
    solutions: solutions?.items.length ?? null,
    useCases,
  };

  return <OrganizationProfilePage mine={{ ...mine, organization }} counts={counts} />;
}
