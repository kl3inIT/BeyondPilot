import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readProposalEvaluations } from "@/features/matching/matching-queries";
import { ProposalEvaluationCard } from "@/features/matching/proposal-evaluations";
import { ReceivedProposalPage } from "@/features/proposal/received-proposal-page";
import { readReceivedProposal } from "@/features/proposal/received-queries";
import { requireRole } from "@/lib/auth/session";
import { adminUseCaseProposalRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/proposals/[proposalId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.received.detail" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AdminUseCaseProposalRoute({
  params,
}: PageProps<"/[locale]/admin/use-cases/[id]/proposals/[proposalId]">) {
  const { locale, id, proposalId } = await params;
  setRequestLocale(locale);
  await requireRole("operator", adminUseCaseProposalRoute(id, proposalId));
  const [proposal, evaluations] = await Promise.all([
    readReceivedProposal(proposalId),
    // The proposal shows without the AI's reading when it cannot be had.
    readProposalEvaluations(id).catch(() => null),
  ]);
  // The proposal must belong to the use case in the address.
  if (!proposal || proposal.useCase.id !== id) {
    notFound();
  }

  return (
    <ReceivedProposalPage
      proposal={proposal}
      area="admin"
      evaluation={
        evaluations && <ProposalEvaluationCard evaluations={evaluations} proposalId={proposal.id} />
      }
    />
  );
}
