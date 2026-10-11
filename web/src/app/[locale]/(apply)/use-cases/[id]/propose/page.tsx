import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProposalBlocked } from "@/features/proposal/proposal-blocked";
import { readProposalForm } from "@/features/proposal/proposal-queries";
import { ProposalWizard } from "@/features/proposal/proposal-wizard";
import { readMySolutions } from "@/features/solution/solution-queries";
import { readMyTalent } from "@/features/talent/talent-queries";
import { getPathname } from "@/i18n/navigation";
import { requireAccount } from "@/lib/auth/session";
import { useCaseProposeRoute as proposeRoute } from "@/lib/site";

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
  if (result.kind === "blocked") {
    return <ProposalBlocked useCaseId={id} reason={result.reason} />;
  }
  const { form } = result;
  if (!form.organization) {
    return <ProposalBlocked useCaseId={id} reason="noOrganization" />;
  }
  if (!form.organization.approved) {
    return <ProposalBlocked useCaseId={id} reason="notApproved" />;
  }
  if (form.proposal?.status === "sent") {
    redirect(getPathname({ href: `${proposeRoute(id)}/sent`, locale: await getLocale() }));
  }

  const [solutions, talent] = await Promise.all([readMySolutions(), readMyTalent()]);

  return (
    <ProposalWizard
      // A proposal read again after another member saved starts afresh, with the version it holds.
      key={form.proposal?.version ?? "new"}
      useCaseId={id}
      form={form}
      organization={form.organization}
      solutions={solutions.items}
      profile={talent.profile ?? null}
      accountName={account.displayName ?? account.email}
    />
  );
}
