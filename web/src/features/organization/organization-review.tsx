"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheckIcon, Undo2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import { failedWith } from "@/lib/api/failure";
import {
  approveOrganization,
  refuseOrganization,
  sendBackOrganization,
  type AdminOrganizationSummary,
  type RefuseOrganization,
} from "@/lib/api/generated";

import { refusalReasons } from "./organization-codes";
import { domainOf, isDomain, websiteHost } from "./organization-format";
import { OrganizationMark } from "./organization-mark";
import { useAdminOrganization } from "./verified-domain";

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
  const [refusing, setRefusing] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);
  const [pending, setPending] = useState(false);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const { id, name } = organization;

  // The domain starts from what the backend proposes, which can still arrive after the dialog
  // opened: the form takes new default values until the operator has touched it.
  const approval = useAppForm({
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
        () =>
          approveOrganization({
            path: { id },
            body: { emailDomain: domainOf(value.emailDomain) || null },
          }),
        "Organization.done.organizationApproved",
      ),
  });
  const sendBack = useAppForm({
    defaultValues: { reason: "" },
    onSubmit: ({ value }) =>
      decide(
        () => sendBackOrganization({ path: { id }, body: { reason: value.reason.trim() } }),
        "Organization.done.organizationSentBack",
      ),
  });
  const sendBackReason = useStore(sendBack.store, (state) => state.values.reason);

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
      if (failedWith(error, "ORGANIZATION_DOMAIN_TAKEN")) {
        setServerErrors(approval, { fields: { emailDomain: { message: t("domainTaken") } } });
      } else {
        notify.failure(error);
      }
      deciding.current = false;
      setPending(false);
    }
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

  if (sendingBack) {
    return (
      <FormDialog
        open
        // Leaving the reason goes back to the review, where the organization can still be approved.
        onOpenChange={(open) => !open && setSendingBack(false)}
        form={sendBack}
        title={t("sendBackTitle", { name })}
        description={t("sendBackLead")}
        mark={{ tone: "warning", icon: Undo2Icon }}
        width="lg"
        submitLabel={t("sendBackConfirm")}
        cancelLabel={t("back")}
        submitDisabled={sendBackReason.trim() === ""}
      >
        <sendBack.AppField name="reason">
          {(field) => (
            <field.TextareaField label={t("sendBackLabel")} rows={4} maxLength={MAX_REASON} />
          )}
        </sendBack.AppField>
      </FormDialog>
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
        confirmLabel={t("refuseConfirm")}
        cancelLabel={t("back")}
        pending={pending}
        onConfirm={refuse}
      />
    );
  }

  const day = format.dateTime(new Date(organization.createdAt), "date");
  const kind = [
    typeName(organization.type),
    organization.country && countryName(organization.country),
    websiteHost(detail?.organization.website),
  ].filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <form
          id={approval.formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void approval.handleSubmit();
          }}
        >
          <DecisionDialogHeader
            tone="success"
            icon={ShieldCheckIcon}
            title={t("title", { name })}
          />
          <div className="flex items-center gap-3 rounded-lg border bg-muted p-3">
            <OrganizationMark name={name} logoFileId={detail?.organization.logoFileId} />
            <div className="grid min-w-0 gap-0.5 text-sm">
              <span className="font-medium break-words">{kind.join(" · ")}</span>
              <span className="text-muted-foreground">
                {detail ? t("lead", { creator: detail.createdBy, day }) : t("leadUnknown", { day })}
              </span>
            </div>
          </div>
          <approval.AppField name="emailDomain">
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
                disabled={pending}
              />
            )}
          </approval.AppField>
          <DialogFooter variant="plain">
            <Button
              size="lg"
              tone="danger"
              prominence="secondary"
              disabled={pending}
              onClick={() => setRefusing(true)}
            >
              {t("refuse")}
            </Button>
            <Button
              size="lg"
              prominence="secondary"
              disabled={pending}
              onClick={() => setSendingBack(true)}
            >
              {t("sendBack")}
            </Button>
            <Button type="submit" size="lg" pending={pending}>
              {t("approve")}
            </Button>
          </DialogFooter>
        </form>
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
