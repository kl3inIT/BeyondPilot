"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { UserCheckIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Person } from "@/components/composites/person";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { useNotify } from "@/hooks/use-notify";
import {
  approveOrganizationClaim,
  declineOrganizationClaim,
  type AdminOrganizationSummary,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";
import { useAdminOrganization, useVerifiedDomain, VerifiedDomainField } from "./verified-domain";

type ClaimDecisionProps = {
  /** The organization nobody owns yet. */
  organization: Pick<AdminOrganizationSummary, "id" | "name">;
  /** The request to own it that is decided. */
  claimId: string;
  /** Closes the dialog, after a decision or without one. */
  onClose: () => void;
};

/**
 * The decision on a claim to own an organization nobody owns, in a dialog: make the person its owner,
 * with the email domain the operator verified, or decline. Who asks and what they wrote are read when
 * the dialog opens.
 */
function ClaimDecision({ organization, claimId, onClose }: ClaimDecisionProps) {
  const t = useTranslations("Admin.organizations.claim");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const detail = useAdminOrganization(organization.id);
  const domain = useVerifiedDomain(detail?.suggestedDomain);
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const { name } = organization;
  const claim = detail?.claims.find((candidate) => candidate.id === claimId);

  async function decide(
    kind: "approve" | "decline",
    run: () => Promise<unknown>,
    done: Parameters<typeof notify.success>[0],
  ) {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(kind);
    try {
      await run();
      notify.success(done);
      onClose();
      router.refresh();
    } catch (error) {
      // A domain another organization has is said at the field; anything else in a toast.
      if (!domain.refused(error)) {
        notify.error(organizationError(error));
      }
      deciding.current = false;
      setPending(null);
    }
  }

  function approve() {
    const emailDomain = domain.read();
    if (emailDomain === undefined) {
      return;
    }
    void decide(
      "approve",
      () => approveOrganizationClaim({ path: { id: claimId }, body: { emailDomain } }),
      "Organization.done.claimApproved",
    );
  }

  const decline = () =>
    decide(
      "decline",
      () => declineOrganizationClaim({ path: { id: claimId } }),
      "Organization.done.claimDeclined",
    );

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent showCloseButton={false}>
        <DecisionDialogHeader
          tone="info"
          icon={UserCheckIcon}
          title={t("title", { name })}
          description={
            claim
              ? t("lead", {
                  day: format.dateTime(new Date(claim.createdAt), { dateStyle: "medium" }),
                })
              : undefined
          }
        />
        {claim && (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted p-3">
            <Person name={claim.name ?? null} email={claim.email} />
            {claim.message && <p className="text-sm whitespace-pre-line">{claim.message}</p>}
          </div>
        )}
        <VerifiedDomainField
          id="claim-domain"
          domain={domain}
          label={t("domain")}
          hint={t("domainHint")}
          problems={{ invalid: t("domainInvalid"), taken: t("domainTaken") }}
          disabled={pending !== null}
        />
        <DialogFooter variant="plain">
          <Button
            size="lg"
            prominence="secondary"
            pending={pending === "decline"}
            disabled={pending === "approve"}
            onClick={decline}
          >
            {t("decline")}
          </Button>
          <Button
            size="lg"
            pending={pending === "approve"}
            disabled={pending === "decline"}
            onClick={approve}
          >
            {t("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the decision on a claim, from the organization's record. */
function ClaimDecisionButton({
  organization,
  claimId,
}: Pick<ClaimDecisionProps, "organization" | "claimId">) {
  const t = useTranslations("Admin.organizations.actions");
  const [deciding, setDeciding] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setDeciding(true)}>
        {t("claim")}
      </Button>
      {deciding && (
        <ClaimDecision
          organization={organization}
          claimId={claimId}
          onClose={() => setDeciding(false)}
        />
      )}
    </>
  );
}

export { ClaimDecision, ClaimDecisionButton };
