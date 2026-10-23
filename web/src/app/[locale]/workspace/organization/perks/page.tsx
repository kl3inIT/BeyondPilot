import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMyPerks, readTeamClaims } from "@/features/perk/perk-queries";
import { TeamPerksPage } from "@/features/perk/team-perks-page";
import { readMySolutions } from "@/features/solution/solution-queries";
import { readUseCaseCount } from "@/features/usecase/my-use-case-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/perks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Perk.team" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function TeamPerksRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/perks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspacePerks);
  const [mine, members] = await Promise.all([readMyOrganization(), readMembers()]);
  const { organization } = mine;
  // A person without an organization gets no perks; the first page offers the ways in.
  if (!organization) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }

  const [solutions, useCases, claims, perks] = await Promise.all([
    readMySolutions(),
    readUseCaseCount({ ...mine, organization }),
    readTeamClaims(),
    readMyPerks(),
  ]);

  return (
    <TeamPerksPage
      mine={{ ...mine, organization }}
      counts={{
        members: members?.total ?? 0,
        solutions: solutions?.items.length ?? null,
        useCases,
      }}
      claims={claims}
      perks={perks}
    />
  );
}
