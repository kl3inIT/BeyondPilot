import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { CompanyPage } from "@/features/solution/company-page";
import {
  readCompany,
  readCompanyDeployments,
  readCompanySolutions,
} from "@/features/solution/solution-queries";
import { loadCompanySearch } from "@/features/solution/solutions-search";
import { titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/organizations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const organization = await readCompany(slug);

  return organization
    ? {
        title: organization.name + titleSuffix,
        description: organization.description ?? undefined,
      }
    : { robots: { index: false } };
}

export default async function OrganizationRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/organizations/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const organization = await readCompany(slug);
  if (!organization) {
    notFound();
  }

  const { more } = await loadCompanySearch(searchParams);
  const [solutions, deployments] = await Promise.all([
    readCompanySolutions(slug, more),
    readCompanyDeployments(slug),
  ]);

  return (
    <CompanyPage
      organization={organization}
      solutions={solutions}
      more={more}
      deployments={deployments}
    />
  );
}
