"use client";

import { EllipsisIcon, ShieldCheckIcon, ShieldOffIcon, UserMinusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Person } from "@/components/composites/person";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  changeAdminOrganizationMemberRole,
  removeAdminOrganizationMember,
  revokeAdminOrganizationInvitation,
  type OrganizationInvitation,
  type OrganizationMember,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

const triggerClass =
  "hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted";

type Asking = "demote" | "remove" | null;

type AdminMemberActionsProps = {
  organizationId: string;
  member: OrganizationMember;
  /** Whether this member is the only owner, whom an operator may still demote or remove. */
  onlyOwner: boolean;
};

/**
 * What an operator does to one member of any organization, in a menu at the end of their row: make
 * them an owner or a member, or take them out. Unlike an owner's own menu it may leave the
 * organization without an owner, so that case asks first and says so.
 */
function AdminMemberActions({ organizationId, member, onlyOwner }: AdminMemberActionsProps) {
  const t = useTranslations("Admin.organizations.people");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<Asking>(null);
  const [pending, setPending] = useState(false);
  const name = member.name ?? member.email;

  async function change(run: () => Promise<unknown>, done: Parameters<typeof notify.success>[0]) {
    setPending(true);
    try {
      await run();
      notify.success(done, { name });
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
      setAsking(null);
    }
  }

  const setRole = (role: OrganizationMember["role"]) =>
    change(
      () =>
        changeAdminOrganizationMemberRole({
          path: { id: organizationId, accountId: member.accountId },
          body: { role },
        }),
      role === "owner" ? "Organization.done.madeOwner" : "Organization.done.madeMember",
    );
  const remove = () =>
    change(
      () =>
        removeAdminOrganizationMember({
          path: { id: organizationId, accountId: member.accountId },
        }),
      "Organization.done.removed",
    );
  const demote = member.role === "owner";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("actions.open", { name })}
              disabled={pending}
              className={triggerClass}
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {demote ? (
              <DropdownMenuItem
                onClick={() => (onlyOwner ? setAsking("demote") : setRole("member"))}
              >
                <ShieldOffIcon aria-hidden="true" />
                {t("actions.makeMember")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setRole("owner")}>
                <ShieldCheckIcon aria-hidden="true" />
                {t("actions.makeOwner")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setAsking("remove")}>
              <UserMinusIcon aria-hidden="true" />
              {t("actions.remove")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && !pending && setAsking(null)}
          title={t(asking === "demote" ? "demote.title" : "remove.title")}
          description={
            asking === "demote"
              ? t("demote.lead")
              : t(onlyOwner ? "remove.lastOwnerLead" : "remove.lead")
          }
          note={t("confirm.note")}
          confirmLabel={t(asking === "demote" ? "demote.confirm" : "remove.confirm")}
          cancelLabel={t("confirm.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={asking === "demote" ? () => setRole("member") : remove}
        >
          <div className="rounded-lg border bg-muted p-3">
            <Person name={member.name ?? null} email={member.email} />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

/** Takes back one open invitation of any organization, after asking. */
function AdminInvitationActions({
  organizationId,
  invitation,
}: {
  organizationId: string;
  invitation: OrganizationInvitation;
}) {
  const t = useTranslations("Admin.organizations.people");
  const roleName = useVocabulary("memberRole");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);

  async function revoke() {
    setPending(true);
    try {
      await revokeAdminOrganizationInvitation({
        path: { id: organizationId, invitationId: invitation.id },
      });
      notify.success("Organization.done.invitationRevoked");
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
      setAsking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("revoke.open", { email: invitation.email })}
        className={triggerClass}
        onClick={() => setAsking(true)}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && !pending && setAsking(false)}
          title={t("revoke.title")}
          description={t("revoke.lead")}
          confirmLabel={t("revoke.confirm")}
          cancelLabel={t("confirm.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={revoke}
        >
          <div className="rounded-lg border bg-muted p-3">
            <Person name={invitation.email} email={roleName(invitation.role)} />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

export { AdminInvitationActions, AdminMemberActions };
