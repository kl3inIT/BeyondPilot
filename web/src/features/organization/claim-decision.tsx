"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { UserCheckIcon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { Person } from "@/components/composites/person";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  approveOrganizationClaim,
  declineOrganizationClaim,
  type AdminOrganizationSummary,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";
import { domainOf, isDomain } from "./organization-format";
import { useAdminOrganization } from "./verified-domain";

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
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const { name } = organization;
  const claim = detail?.claims.find((candidate) => candidate.id === claimId);

  // The domain starts from what the backend proposes, which can still arrive after the dialog
  // opened: the form takes new default values until the operator has touched it.
  const form = useAppForm({
    defaultValues: { emailDomain: detail?.suggestedDomain ?? "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        emailDomain: z
          .string()
          .refine((text) => domainOf(text) === "" || isDomain(domainOf(text)), t("domainInvalid")),
      }),
    },
    onSubmit: ({ value }) =>
      decide(
        "approve",
        () =>
          approveOrganizationClaim({
            path: { id: claimId },
            body: { emailDomain: domainOf(value.emailDomain) || null },
          }),
        "Organization.done.claimApproved",
      ),
  });

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
      if (error instanceof ApiError && error.code === "ORGANIZATION_DOMAIN_TAKEN") {
        setServerErrors(form, { fields: { emailDomain: { message: t("domainTaken") } } });
      } else {
        notify.error(organizationError(error));
      }
      deciding.current = false;
      setPending(null);
    }
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
        <form
          id={form.formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
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
          <form.AppField name="emailDomain">
            {(field) => (
              <field.TextField
                label={t("domain")}
                description={t("domainHint")}
                inputMode="url"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                maxLength={253}
                uncounted
                disabled={pending !== null}
              />
            )}
          </form.AppField>
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
              type="submit"
              size="lg"
              pending={pending === "approve"}
              disabled={pending === "decline"}
            >
              {t("approve")}
            </Button>
          </DialogFooter>
        </form>
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
