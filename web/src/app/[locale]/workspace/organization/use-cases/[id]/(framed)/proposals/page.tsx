import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReceivedProposalsPage } from "@/features/proposal/received-proposals-page";
import { loadReceivedSearch } from "@/features/proposal/received-search";
import { readReceivedProposals } from "@/features/proposal/received-queries";
import { requireAccount } from "@/lib/auth/session";
import { workspaceUseCaseProposalsRoute } from "@/lib/site";

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
  const [proposals, search] = await Promise.all([
    readReceivedProposals(id),
    loadReceivedSearch(searchParams),
  ]);
  if (!proposals) {
    notFound();
  }

  return <ReceivedProposalsPage proposals={proposals} tab={search.tab} />;
}
