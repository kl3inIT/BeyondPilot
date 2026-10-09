"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  restoreOrganization,
  takeDownOrganization,
  type Organization,
  type TakeDownOrganization,
} from "@/lib/api/generated";

import { takeDownReasons } from "./organization-codes";
import { organizationError } from "./organization-errors";

type TakeDownProps = {
  organization: Pick<Organization, "id" | "name">;
};

/**
 * Takes an approved organization down with a reason its owners read. The page and its solutions
 * leave the directories at once; the people keep their workspace. It stays open while the decision
 * is sent; whoever opened it closes it.
 */
function TakeDownDialog({
  organization,
  members,
  onClose,
}: TakeDownProps & {
  /** How many people keep their workspace. */
  members: number;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.organizations.takeDown");
  const reasonName = useVocabulary("organizationTakeDown");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function takeDown(reason: string, message: string) {
    setPending(true);
    try {
      await takeDownOrganization({
        path: { id: organization.id },
        body: { reason: reason as TakeDownOrganization["reason"], message: message.trim() || null },
      });
      notify.success("Organization.done.takenDown", { name: organization.name });
      onClose();
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && !pending && onClose()}
      title={t("title", { name: organization.name })}
      description={t("lead", { members })}
      reasonLabel={t("reason")}
      reasonPlaceholder={t("reasonPlaceholder")}
      reasons={takeDownReasons.map((value) => ({ value, label: reasonName(value) }))}
      messageLabel={t("message")}
      messageHint={t("messageHint")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      pending={pending}
      onConfirm={takeDown}
    />
  );
}

/** Puts a taken-down organization back: its page, its solutions and what its owners may do. */
function RestoreButton({ organization, reason }: TakeDownProps & { reason: string }) {
  const t = useTranslations("Admin.organizations.takeDown");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function restore() {
    setPending(true);
    try {
      await restoreOrganization({ path: { id: organization.id } });
      notify.success("Organization.done.restored", { name: organization.name });
      setAsking(false);
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button prominence="secondary" onClick={() => setAsking(true)}>
        {t("restore")}
      </Button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && !pending && setAsking(false)}
          title={t("restoreTitle", { name: organization.name })}
          description={t("restoreLead")}
          note={t("restoreNote")}
          confirmLabel={t("restore")}
          cancelLabel={t("cancel")}
          pending={pending}
          onConfirm={restore}
        >
          <p className="rounded-lg border bg-muted p-3 text-sm">{reason}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

export { RestoreButton, TakeDownDialog };
