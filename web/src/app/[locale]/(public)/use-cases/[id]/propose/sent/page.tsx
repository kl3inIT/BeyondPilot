import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { readProposalForm } from "@/features/proposal/proposal-queries";
import { ProposalSentPage } from "@/features/proposal/proposal-sent-page";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { proposeToUseCaseRoute as proposeRoute } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose/sent">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UseCaseProposal.wizard.sent" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/** The confirmation after a proposal was sent; a proposal that was not sent goes back to its form. */
export default async function ProposalSentRoute({
  params,
}: PageProps<"/[locale]/use-cases/[id]/propose/sent">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAccount(`${proposeRoute(id)}/sent`);
  const result = await readProposalForm(id);
  if (result.kind !== "form") {
    notFound();
  }
  const { form } = result;
  if (form.proposal?.status !== "sent") {
    redirect(getPathname({ href: proposeRoute(id), locale: await getLocale() }));
  }

  return <ProposalSentPage form={form} proposal={form.proposal} />;
}
