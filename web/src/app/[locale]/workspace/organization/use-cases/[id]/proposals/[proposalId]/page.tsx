import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WorkspaceFrame } from "@/components/layout/workspace-frame";
import { ReceivedProposalPage } from "@/features/proposal/received-proposal-page";
import { readReceivedProposal } from "@/features/proposal/received-queries";
import { requireAccount } from "@/lib/auth/session";
import { workspaceUseCaseProposalRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/proposals/[proposalId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.received.detail" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function OrganizationUseCaseProposalRoute({
  params,
}: PageProps<"/[locale]/workspace/organization/use-cases/[id]/proposals/[proposalId]">) {
  const { locale, id, proposalId } = await params;
  setRequestLocale(locale);
  await requireAccount(workspaceUseCaseProposalRoute(id, proposalId));
  const proposal = await readReceivedProposal(proposalId);
  // The proposal must belong to the use case in the address.
  if (!proposal || proposal.useCase.id !== id) {
    notFound();
  }

  return (
    <WorkspaceFrame>
      <ReceivedProposalPage proposal={proposal} />
    </WorkspaceFrame>
  );
}
