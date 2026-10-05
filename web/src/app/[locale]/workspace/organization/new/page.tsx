import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OrganizationForm } from "@/features/organization/organization-form";
import { readMyOrganization } from "@/features/organization/organization-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

const path = `${siteRoutes.workspaceOrganization}/new`;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Organization.form" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function CreateOrganizationRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAccount(path);
  const mine = await readMyOrganization();
  // A person belongs to one organization; whoever has one, or asked to join one, goes to its pages.
  if (mine.organization || mine.request) {
    redirect(getPathname({ href: siteRoutes.workspaceOrganization, locale }));
  }

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24 lg:px-16">
      <div className="w-full max-w-220">
        <OrganizationForm />
      </div>
    </div>
  );
}
