import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { RequestIntroduction } from "@/features/introduction/request-introduction";
import { readMyOrganization } from "@/features/organization/organization-queries";
import { SolutionPage } from "@/features/solution/solution-page";
import { readMySolutions, readSolution } from "@/features/solution/solution-queries";
import { getPathname } from "@/i18n/navigation";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const solution = await readSolution(slug);

  return solution
    ? { title: solution.name + titleSuffix, description: solution.summary ?? undefined }
    : { robots: { index: false } };
}

export default async function SolutionRoute({ params }: PageProps<"/[locale]/solutions/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const solution = await readSolution(slug);
  if (!solution) {
    notFound();
  }

  const account = await getCurrentAccount();
  const [mine, organization] = account
    ? await Promise.all([
        readMySolutions().catch(() => null),
        readMyOrganization()
          .then((found) => found.organization ?? null)
          .catch(() => null),
      ])
    : [null, null];
  const own = mine?.editable ? mine.items.find((item) => item.slug === slug) : undefined;
  // A visitor signs in first and comes back to this solution to ask.
  const returnTo = getPathname({ href: `${siteRoutes.solutions}/${solution.slug}`, locale });
  const signInHref = account
    ? undefined
    : `${siteRoutes.signIn}?${new URLSearchParams({ returnTo })}`;
  // The people of the organization that offers the solution have nobody to ask but themselves.
  const asksOwnCompany = organization?.slug === solution.organizationSlug;

  return (
    <SolutionPage
      solution={solution}
      editHref={own && `${siteRoutes.workspaceSolutions}/${own.id}`}
      introduction={
        asksOwnCompany ? undefined : (
          <RequestIntroduction
            slug={solution.slug}
            name={solution.name}
            provider={solution.organizationName}
            organization={organization?.name ?? null}
            awaitingApproval={organization ? organization.status !== "approved" : false}
            signInHref={signInHref}
          />
        )
      }
    />
  );
}
