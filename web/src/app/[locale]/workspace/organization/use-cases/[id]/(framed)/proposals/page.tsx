import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readProposalEvaluations } from "@/features/matching/matching-queries";
import { ProposalCompare } from "@/features/matching/proposal-evaluations";
import { inTab } from "@/features/proposal/received-proposals";
import { ReceivedProposalsPage } from "@/features/proposal/received-proposals-page";
import { loadReceivedSearch } from "@/features/proposal/received-search";
import { readReceivedProposals } from "@/features/proposal/received-queries";
import { requireAccount } from "@/lib/auth/session";
import { workspaceUseCaseProposalRoute, workspaceUseCaseProposalsRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/proposals">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.received.list" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseProposalsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/proposals">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(workspaceUseCaseProposalsRoute(id));
  const [proposals, search, evaluations] = await Promise.all([
    readReceivedProposals(id),
    loadReceivedSearch(searchParams),
    // The list shows without the comparison when the AI's reading cannot be had.
    readProposalEvaluations(id).catch(() => null),
  ]);
  if (!proposals) {
    notFound();
  }

  return (
    <ReceivedProposalsPage
      proposals={proposals}
      tab={search.tab}
      view={search.view}
      compare={
        evaluations && (
          <ProposalCompare
            evaluations={evaluations}
            columns={inTab(proposals.items, search.tab).map((item) => ({
              id: item.id,
              name: item.organizationName,
              href: workspaceUseCaseProposalRoute(id, item.id),
            }))}
          />
        )
      }
    />
  );
}
