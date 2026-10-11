import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { editStateOf } from "@/features/proposal/proposal-access";
import { readProposalForm } from "@/features/proposal/proposal-queries";
import { ProposalViewPage } from "@/features/proposal/proposal-view-page";
import { readUseCase } from "@/features/usecase/use-cases-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { proposalViewRoute, proposeToUseCaseRoute as proposeRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose/view">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.view" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/** The proposal the caller's organization sent, read-only; one not sent yet goes back to its form. */
export default async function ProposalViewRoute({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose/view">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(proposalViewRoute(id));
  const result = await readProposalForm(id);
  if (result.kind !== "form") {
    notFound();
  }
  const { form } = result;
  if (form.proposal?.status !== "sent") {
    redirect(getPathname({ href: proposeRoute(id), locale: await getLocale() }));
  }
  const edit = editStateOf(form.proposal, {
    closesAt: form.useCase.closesAt,
    // The days only explain why editing is over, so the use case is read only then.
    proposalEditDays: form.proposal.editableUntil
      ? undefined
      : (await readUseCase(id))?.proposalEditDays,
  });

  return <ProposalViewPage form={form} proposal={form.proposal} edit={edit} />;
}
