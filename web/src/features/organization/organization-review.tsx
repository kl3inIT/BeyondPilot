"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  approveOrganization,
  refuseOrganization,
  sendBackOrganization,
  type AdminOrganizationSummary,
  type RefuseOrganization,
} from "@/lib/api/generated";

import { refusalReasons } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { websiteHost } from "./organization-format";
import { useAdminOrganization, useVerifiedDomain, VerifiedDomainField } from "./verified-domain";

/** The longest reason for a send back that the backend takes. */
const MAX_REASON = 1000;

type OrganizationReviewProps = {
  /** The organization that waits for a decision, as the list already holds it. */
  organization: Pick<AdminOrganizationSummary, "id" | "name" | "type" | "country" | "createdAt">;
  /** Closes the review, after a decision or without one. */
  onClose: () => void;
};

/**
 * The decision on an organization that waits for review, in a dialog: approve it, with the email
 * domain the operator verified; send it back with what its owners should change; or refuse it for
 * good with a reason they read. Who created it, its website and the domain to confirm are read when
 * the dialog opens; the dialog does not wait for them.
 */
function OrganizationReview({ organization, onClose }: OrganizationReviewProps) {
  const t = useTranslations("Admin.organizations.review");
  const typeName = useVocabulary("organizationType");
  const reasonName = useVocabulary("organizationRefusal");
  const countryName = useCountryName();
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const detail = useAdminOrganization(organization.id);
  const domain = useVerifiedDomain(detail?.suggestedDomain);
  const [refusing, setRefusing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");
  const sendBackId = useId();
  const [pending, setPending] = useState(false);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const { id, name } = organization;

  async function decide(run: () => Promise<unknown>, done: Parameters<typeof notify.success>[0]) {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(true);
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
      setPending(false);
    }
  }

  function approve() {
    const emailDomain = domain.read();
    if (emailDomain === undefined) {
      return;
    }
    void decide(
      () => approveOrganization({ path: { id }, body: { emailDomain } }),
      "Organization.done.organizationApproved",
    );
  }
  const refuse = (reason: string, message: string) =>
    decide(
      () =>
        refuseOrganization({
          path: { id },
          body: { reason: reason as RefuseOrganization["reason"], message: message.trim() || null },
        }),
      "Organization.done.organizationRefused",
    );

  const sendBack = () =>
    decide(
      () => sendBackOrganization({ path: { id }, body: { reason: sendBackReason.trim() } }),
      "Organization.done.organizationSentBack",
    );

  if (sendingBack) {
    return (
      // Leaving the reason goes back to the review, where the organization can still be approved.
      <Dialog open onOpenChange={(open) => !open && !pending && setSendingBack(false)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("sendBackTitle", { name })}</DialogTitle>
            <DialogDescription>{t("sendBackLead")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={sendBackId}>{t("sendBackLabel")}</FieldLabel>
            <Textarea
              id={sendBackId}
              rows={4}
              maxLength={MAX_REASON}
              value={sendBackReason}
              onChange={(event) => setSendBackReason(event.target.value)}
            />
            <FieldDescription>{t("messageHint")}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button prominence="secondary" disabled={pending} onClick={() => setSendingBack(false)}>
              {t("back")}
            </Button>
            <Button
              pending={pending}
              disabled={sendBackReason.trim() === ""}
              onClick={() => void sendBack()}
            >
              {t("sendBackConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (refusing) {
    return (
      <ReasonDialog
        open
        // Leaving the reason goes back to the review, where the organization can still be approved.
        onOpenChange={setRefusing}
        title={t("refuseTitle", { name })}
        description={t("refuseLead")}
        reasonLabel={t("reason")}
        reasonPlaceholder={t("reasonPlaceholder")}
        reasons={refusalReasons.map((value) => ({ value, label: reasonName(value) }))}
        messageLabel={t("message")}
        messageHint={t("messageHint")}
        confirmLabel={t("refuseConfirm")}
        cancelLabel={t("back")}
        pending={pending}
        onConfirm={refuse}
      />
    );
  }

  const day = format.dateTime(new Date(organization.createdAt), { dateStyle: "medium" });
  const kind = [
    typeName(organization.type),
    organization.country && countryName(organization.country),
    websiteHost(detail?.organization.website),
  ].filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle size="lg">{t("title", { name })}</DialogTitle>
          <DialogDescription>
            <span className="block">{kind.join(" · ")}</span>
            <span className="block">
              {detail ? t("lead", { creator: detail.createdBy, day }) : t("leadUnknown", { day })}
            </span>
          </DialogDescription>
        </DialogHeader>
        <VerifiedDomainField
          id="review-domain"
          domain={domain}
          label={t("domain")}
          hint={t("domainHint")}
          problems={{ invalid: t("domainInvalid"), taken: t("domainTaken") }}
          disabled={pending}
        />
        <DialogFooter>
          <Button prominence="secondary" disabled={pending} onClick={() => setRefusing(true)}>
            {t("refuse")}
          </Button>
          <Button prominence="secondary" disabled={pending} onClick={() => setSendingBack(true)}>
            {t("sendBack")}
          </Button>
          <Button size="lg" pending={pending} onClick={approve}>
            {t("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opens the review of an organization that waits for a decision, from its record. */
function OrganizationReviewButton({ organization }: Pick<OrganizationReviewProps, "organization">) {
  const t = useTranslations("Admin.organizations.detail");
  const [reviewing, setReviewing] = useState(false);

  return (
    <>
      <Button onClick={() => setReviewing(true)}>{t("review")}</Button>
      {reviewing && (
        <OrganizationReview organization={organization} onClose={() => setReviewing(false)} />
      )}
    </>
  );
}

export { OrganizationReview, OrganizationReviewButton };
