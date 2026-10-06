import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readReceivedIntroductions } from "@/features/introduction/introduction-queries";
import { IntroductionsPage } from "@/features/introduction/introductions-page";
import { readMembers, readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/introductions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Introduction.received" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function IntroductionsRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/introductions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(siteRoutes.workspaceIntroductions);
  const [mine, introductions, solutions, members] = await Promise.all([
    readMyOrganization(),
    readReceivedIntroductions(),
    readMySolutions(),
    readMembers(),
  ]);
  const { organization } = mine;
  // Introductions are asked of an organization; anyone without one is shown the organization page.
  if (!organization || !introductions) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }

  return (
    <IntroductionsPage
      mine={{ ...mine, organization }}
      introductions={introductions}
      members={members?.members.length ?? 0}
      solutions={solutions.items.length}
    />
  );
}
