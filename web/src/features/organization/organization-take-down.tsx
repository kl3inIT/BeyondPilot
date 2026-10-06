"use client";

import { EllipsisIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * What an operator does to an approved organization from its record, in a menu: take it down with a
 * reason its owners read. The page and its solutions leave the directories at once; the people keep
 * their workspace.
 */
function TakeDownMenu({
  organization,
  members,
}: TakeDownProps & {
  /** How many people keep their workspace. */
  members: number;
}) {
  const t = useTranslations("Admin.organizations.takeDown");
  const reasonName = useVocabulary("organizationTakeDown");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function takeDown(reason: string, message: string) {
    setPending(true);
    try {
      await takeDownOrganization({
        path: { id: organization.id },
        body: { reason: reason as TakeDownOrganization["reason"], message: message.trim() || null },
      });
      notify.success("Organization.done.takenDown", { name: organization.name });
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("open", { name: organization.name })}
              className="hit-area flex size-9 shrink-0 items-center justify-center rounded-md border outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setAsking(true)}>
              <EyeOffIcon aria-hidden="true" />
              {t("menu")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking && (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && !pending && setAsking(false)}
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
      )}
    </>
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

export { RestoreButton, TakeDownMenu };
