import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { getUseCaseProposalForm } from "@/lib/api/generated";
import { getCurrentAccount, sessionRequest } from "@/lib/auth/session";
// The route helpers are named `useCase…`, which the hooks rule reads as hooks: they are called through the module.
import * as site from "@/lib/site";

import { accessOfForm, accessOfRefusal, closedAt, type SenderAccess } from "./proposal-access";
import { ProposalSaveLater } from "./proposal-save-later";

type ProposalActionsProps = {
  useCaseId: string;
  closesAt?: string | null;
};

/** What the signed-in visitor may do about the use case; a failed read leaves the buttons in place. */
async function readAccess(useCaseId: string): Promise<SenderAccess> {
  try {
    const { data } = await getUseCaseProposalForm({
      ...(await sessionRequest()),
      path: { useCaseId },
    });
    return accessOfForm(data);
  } catch (error) {
    return error instanceof ApiError
      ? accessOfRefusal(error.status, error.code)
      : { kind: "open", draft: false };
  }
}

/**
 * Send a proposal and Save for later, in the card of a public use case. Nobody sees them for their
 * own organization's use case or one that takes no more proposals; a visitor who is signed out is
 * taken through signing in and returns; an organization GenAI Fund has not approved sees the
 * button disabled with the reason. Reading what the caller may do never stops the page from showing.
 */
async function ProposalActions({ useCaseId, closesAt }: ProposalActionsProps) {
  if (closedAt(closesAt)) {
    return null;
  }
  const [t, e, o, account, locale] = await Promise.all([
    getTranslations("UseCases.detail.open"),
    getTranslations("UseCaseProposal.errors"),
    getTranslations("UseCaseProposal.actions"),
    getCurrentAccount(),
    getLocale(),
  ]);
  const access: SenderAccess = account
    ? await readAccess(useCaseId)
    : { kind: "open", draft: false };
  if (access.kind === "hidden") {
    return null;
  }
  // A visitor signs in first and comes back to this page to save.
  const signIn = `${site.siteRoutes.signIn}?${new URLSearchParams({
    returnTo: getPathname({ href: site.useCaseRoute(useCaseId), locale }),
  })}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        {access.kind === "sent" ? (
          <p className="text-sm font-medium">{o("sent")}</p>
        ) : (
          <>
            {access.kind === "blocked" ? (
              <Button className="w-full" size="lg" disabled>
                {t("send")}
              </Button>
            ) : (
              <Button className="w-full" size="lg" href={site.useCaseProposeRoute(useCaseId)}>
                {access.kind === "open" && access.draft ? o("continue") : t("send")}
              </Button>
            )}
            {access.kind === "blocked" && (
              <p className="text-sm text-muted-foreground">{e(access.code)}</p>
            )}
            {!account ? (
              <Button className="w-full" prominence="secondary" size="lg" href={signIn}>
                {t("save")}
              </Button>
            ) : (
              access.kind === "open" && !access.draft && <ProposalSaveLater useCaseId={useCaseId} />
            )}
          </>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t("note")}</p>
    </>
  );
}

export { ProposalActions };
