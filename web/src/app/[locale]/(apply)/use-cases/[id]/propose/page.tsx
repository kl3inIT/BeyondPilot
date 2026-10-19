import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProposalBlocked } from "@/features/proposal/proposal-blocked";
import { readProposalForm } from "@/features/proposal/proposal-queries";
import { ProposalWizard } from "@/features/proposal/proposal-wizard";
import { readMyOrganization } from "@/features/organization/organization-queries";
import { readMySolutions } from "@/features/solution/solution-queries";
import { readMyTalent } from "@/features/talent/talent-queries";
import { readUseCase } from "@/features/usecase/use-cases-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import {
  programApplyRoute,
  proposalViewRoute,
  proposeToUseCaseRoute as proposeRoute,
  useCaseRoute as briefOf,
} from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.wizard" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/** Sending a proposal to a use case. Signing in comes first and returns here. */
export default async function ProposeRoute({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const account = await requireAccount(proposeRoute(id));
  const result = await readProposalForm(id);

  if (result.kind === "absent") {
    notFound();
  }
  if (result.kind === "challenge") {
    // The challenge's application answers the use case; once it closes, the use case takes proposals again.
    const useCase = await readUseCase(id);
    const href = useCase?.challenge ? programApplyRoute(useCase.challenge.slug) : briefOf(id);
    redirect(getPathname({ href, locale: await getLocale() }));
  }
  if (result.kind === "blocked") {
    return <ProposalBlocked useCaseId={id} reason={result.reason} />;
  }
  const { form } = result;
  // A sent proposal opens for editing while its window is open, and is only read after it.
  if (form.proposal?.status === "sent" && !form.proposal.editableUntil) {
    redirect(getPathname({ href: proposalViewRoute(id), locale: await getLocale() }));
  }

  const [solutions, talent, mine] = await Promise.all([
    readMySolutions(),
    readMyTalent(),
    readMyOrganization(),
  ]);

  return (
    <ProposalWizard
      useCaseId={id}
      form={form}
      organization={form.organization ?? null}
      suggestion={mine.suggestion ?? null}
      request={mine.request ?? null}
      solutions={solutions.items}
      profile={talent.profile ?? null}
      account={account}
    />
  );
}
