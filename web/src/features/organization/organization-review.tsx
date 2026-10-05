"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Person } from "@/components/composites/person";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotify } from "@/hooks/use-notify";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import {
  approveOrganization,
  getAdminOrganization,
  refuseOrganization,
  type AdminOrganization,
  type AdminOrganizationSummary,
  type RefuseOrganization,
} from "@/lib/api/generated";

import { refusalReasons } from "./organization-codes";
import { organizationError } from "./organization-errors";
import { websiteHost } from "./organization-format";

type OrganizationReviewProps = {
  /** The organization that waits for a decision, as the list already holds it. */
  organization: Pick<AdminOrganizationSummary, "id" | "name" | "type" | "country" | "createdAt">;
  /** Closes the review, after a decision or without one. */
  onClose: () => void;
};

/**
 * The decision on an organization that waits for review, in a dialog: approve it, or go on to refuse
 * it with a reason its owners read. Who created it and its website are read when the dialog opens;
 * the dialog does not wait for them.
 */
function OrganizationReview({ organization, onClose }: OrganizationReviewProps) {
  const t = useTranslations("Admin.organizations.review");
  const typeName = useVocabulary("organizationType");
  const reasonName = useVocabulary("organizationRefusal");
  const countryName = useCountryName();
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const [detail, setDetail] = useState<AdminOrganization | null>(null);
  const [refusing, setRefusing] = useState(false);
  const [pending, setPending] = useState(false);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);
  const { id, name } = organization;

  useEffect(() => {
    let current = true;
    getAdminOrganization({ path: { id } })
      .then(({ data }) => current && setDetail(data))
      // Without the record the dialog still says what the list knows.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [id]);

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
      notify.error(organizationError(error));
      deciding.current = false;
      setPending(false);
    }
  }

  const approve = () =>
    decide(() => approveOrganization({ path: { id } }), "Organization.done.organizationApproved");
  const refuse = (reason: string, message: string) =>
    decide(
      () =>
        refuseOrganization({
          path: { id },
          body: { reason: reason as RefuseOrganization["reason"], message: message.trim() || null },
        }),
      "Organization.done.organizationRefused",
    );

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
          <DialogTitle>{t("title", { name })}</DialogTitle>
          <DialogDescription>
            {detail ? t("lead", { creator: detail.createdBy, day }) : t("leadUnknown", { day })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted p-3">
          <Person name={name} email={kind.join(" · ")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("note")}</p>
        <DialogFooter>
          <Button prominence="secondary" disabled={pending} onClick={() => setRefusing(true)}>
            {t("refuse")}
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
  const t = useTranslations("Admin.organizations.actions");
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
