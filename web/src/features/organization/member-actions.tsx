"use client";

import {
  LogOutIcon,
  PencilIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserMinusIcon,
  BriefcaseIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { Person } from "@/components/composites/person";
import { useAppForm } from "@/components/form/app-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import {
  changeMyJobTitle,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  type OrganizationMember,
} from "@/lib/api/generated";

type MemberActionsProps = {
  member: OrganizationMember;
  /** Whether the person looking at the list owns the organization. */
  owner: boolean;
  /** True when this member is known to be the organization's one owner. */
  onlyOwner: boolean;
};

/**
 * What can be done to one member, in a menu at the end of their row. An owner changes the role of
 * others and removes them; anyone changes their own job title and takes themselves out. A change
 * of someone else's role tells nobody and the other role undoes it, so it runs at once and its
 * toast offers Undo; an owner who gives up their own role cannot take it back, so that is asked
 * once, and so is removing. The organization keeps an owner: the one owner is not offered the
 * ways out, with the reason shown, and the backend refuses them all the same.
 */
function MemberActions({ member, owner, onlyOwner }: MemberActionsProps) {
  const t = useTranslations("Organization.members");
  const refusal = useTranslations("Errors");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<"remove" | "demote" | null>(null);
  const [titling, setTitling] = useState(false);
  const [pending, setPending] = useState(false);
  // The page shows the change once it has read it again; until then the action cannot be repeated.
  const [refreshing, startRefresh] = useTransition();
  const name = member.name ?? member.email;

  if (!owner && !member.self) {
    return null;
  }

  async function change(
    run: () => Promise<unknown>,
    done: Parameters<typeof notify.success>[0],
    undo?: () => void,
  ) {
    setPending(true);
    try {
      await run();
      notify.success(done, { name }, undo && { undo });
      startRefresh(() => router.refresh());
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
      setAsking(null);
    }
  }

  /** Changes the role; what Undo sends, and what an owner does to themselves, offers no Undo. */
  const setRole = (role: OrganizationMember["role"], undoable: boolean): Promise<void> =>
    change(
      () => changeOrganizationMemberRole({ path: { accountId: member.accountId }, body: { role } }),
      role === "owner" ? "Organization.done.madeOwner" : "Organization.done.madeMember",
      undoable ? () => void setRole(role === "owner" ? "member" : "owner", false) : undefined,
    );
  const remove = () =>
    change(
      () => removeOrganizationMember({ path: { accountId: member.accountId } }),
      member.self ? "Organization.done.left" : "Organization.done.removed",
    );

  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label={t("actions.open", { name })} disabled={pending || refreshing} />
        <DropdownMenuContent align="end" className="w-56">
          {member.self && (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTitling(true)}>
                <PencilIcon aria-hidden="true" />
                {t("actions.editJobTitle")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {owner && (
            <>
              <DropdownMenuGroup>
                {member.role === "owner" && onlyOwner ? (
                  <DropdownMenuItem disabled>
                    <ShieldOffIcon className="self-start" aria-hidden="true" />
                    <span className="flex flex-col">
                      {t("actions.makeMember")}
                      <span className="text-xs">{refusal("ORGANIZATION_LAST_OWNER")}</span>
                    </span>
                  </DropdownMenuItem>
                ) : member.role === "owner" ? (
                  <DropdownMenuItem
                    onClick={() => (member.self ? setAsking("demote") : setRole("member", true))}
                  >
                    <ShieldOffIcon aria-hidden="true" />
                    {t("actions.makeMember")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setRole("owner", true)}>
                    <ShieldCheckIcon aria-hidden="true" />
                    {t("actions.makeOwner")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {onlyOwner ? (
              // The reason is said once, under the role above: the one owner reads their own menu.
              <DropdownMenuItem disabled>
                <LogOutIcon aria-hidden="true" />
                {t("actions.leave")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setAsking("remove")}>
                {member.self ? (
                  <LogOutIcon aria-hidden="true" />
                ) : (
                  <UserMinusIcon aria-hidden="true" />
                )}
                {t(member.self ? "actions.leave" : "actions.remove")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking === "demote" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(null)}
          title={t("confirm.demoteSelf.title")}
          description={t("confirm.demoteSelf.lead")}
          confirmLabel={t("confirm.demoteSelf.confirm")}
          cancelLabel={t("confirm.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={() => setRole("member", false)}
        />
      )}
      {asking === "remove" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(null)}
          title={t(member.self ? "confirm.leave.title" : "confirm.remove.title")}
          description={t(member.self ? "confirm.leave.lead" : "confirm.remove.lead")}
          note={t("confirm.note")}
          confirmLabel={t(member.self ? "confirm.leave.confirm" : "confirm.remove.confirm")}
          cancelLabel={t("confirm.cancel")}
          tone="danger"
          pending={pending}
          onConfirm={remove}
        >
          <div className="rounded-lg border bg-muted p-3">
            <Person name={member.name ?? null} email={member.email} />
          </div>
        </ConfirmDialog>
      )}
      {member.self && (
        <JobTitleDialog
          jobTitle={member.jobTitle ?? ""}
          open={titling}
          onOpenChange={setTitling}
          onSaved={() => startRefresh(() => router.refresh())}
        />
      )}
    </>
  );
}

type JobTitleDialogProps = {
  /** The caller's job title as the list holds it; empty when they have none. */
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the title is saved, to read the list again. */
  onSaved: () => void;
};

/** Changes the caller's own job title; an empty one takes it away. */
function JobTitleDialog({ jobTitle, open, onOpenChange, onSaved }: JobTitleDialogProps) {
  const t = useTranslations("Organization.members.jobTitle");
  const notify = useNotify();
  const form = useAppForm({
    defaultValues: { jobTitle },
    onSubmit: async ({ value }) => {
      try {
        await changeMyJobTitle({ body: { jobTitle: value.jobTitle.trim() || null } });
        notify.success("Organization.done.jobTitleSaved");
        onOpenChange(false);
        onSaved();
      } catch (error) {
        notify.failure(error);
      }
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={t("title")}
      mark={{ tone: "info", icon: BriefcaseIcon }}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <form.AppField name="jobTitle">
        {(field) => (
          <field.TextField label={t("label")} autoComplete="organization-title" maxLength={120} />
        )}
      </form.AppField>
    </FormDialog>
  );
}

export { MemberActions };
