import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { contactRoute } from "@/features/messaging/messaging-search";
import { readSolutionPerks } from "@/features/perk/perk-queries";
import { SolutionPage } from "@/features/solution/solution-page";
import { readMySolutions, readSolution } from "@/features/solution/solution-queries";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const solution = await readSolution(slug);

  return solution
    ? {
        title: solution.name + titleSuffix,
        description: solution.summary ?? undefined,
        // An unlisted solution is shared by its address, not found through a search engine.
        robots: solution.listed ? undefined : { index: false },
      }
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
  const mine = account ? await readMySolutions().catch(() => null) : null;
  const theirs = mine?.items.find((item) => item.slug === slug);
  const own = mine?.editable ? theirs : undefined;
  const perks = await readSolutionPerks([solution.slug]);

  return (
    <SolutionPage
      solution={solution}
      perks={perks[solution.slug]}
      editHref={own && `${siteRoutes.workspaceSolutions}/${own.id}`}
      // The people of the organization that offers the solution have nobody to write to but
      // themselves. A visitor signs in first and comes back to the first message.
      contactHref={
        theirs
          ? undefined
          : contactRoute({ kind: "solution", slug: solution.slug }, !!account, locale)
      }
    />
  );
}
