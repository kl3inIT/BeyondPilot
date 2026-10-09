"use client";

import {
  EllipsisIcon,
  LogOutIcon,
  PencilIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserMinusIcon,
  BriefcaseIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Person } from "@/components/composites/person";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import {
  changeMyJobTitle,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  type OrganizationMember,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

type MemberActionsProps = {
  member: OrganizationMember;
  /** Whether the person looking at the list owns the organization. */
  owner: boolean;
};

/**
 * What can be done to one member, in a menu at the end of their row. An owner changes the role of
 * others and removes them; anyone changes their own job title and takes themselves out. Removing
 * asks first, and the organization keeps an owner: the backend refuses the last one's leaving.
 */
function MemberActions({ member, owner }: MemberActionsProps) {
  const t = useTranslations("Organization.members");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [titling, setTitling] = useState(false);
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [pending, setPending] = useState(false);
  const name = member.name ?? member.email;

  if (!owner && !member.self) {
    return null;
  }

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
      setAsking(false);
    }
  }

  async function saveJobTitle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await changeMyJobTitle({ body: { jobTitle: jobTitle.trim() || null } });
      notify.success("Organization.done.jobTitleSaved");
      setTitling(false);
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  const setRole = (role: OrganizationMember["role"]) =>
    change(
      () => changeOrganizationMemberRole({ path: { accountId: member.accountId }, body: { role } }),
      role === "owner" ? "Organization.done.madeOwner" : "Organization.done.madeMember",
    );
  const remove = () =>
    change(
      () => removeOrganizationMember({ path: { accountId: member.accountId } }),
      member.self ? "Organization.done.left" : "Organization.done.removed",
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("actions.open", { name })}
              disabled={pending}
              className="hit-area flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {member.self && (
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  setJobTitle(member.jobTitle ?? "");
                  setTitling(true);
                }}
              >
                <PencilIcon aria-hidden="true" />
                {t("actions.editJobTitle")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {owner && (
            <>
              <DropdownMenuGroup>
                {member.role === "owner" ? (
                  <DropdownMenuItem onClick={() => setRole("member")}>
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
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setAsking(true)}>
              {member.self ? (
                <LogOutIcon aria-hidden="true" />
              ) : (
                <UserMinusIcon aria-hidden="true" />
              )}
              {t(member.self ? "actions.leave" : "actions.remove")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(false)}
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
      {titling && (
        <Dialog open onOpenChange={(open) => !open && !pending && setTitling(false)}>
          <DialogContent showCloseButton={false}>
            <form noValidate onSubmit={saveJobTitle} className="flex flex-col gap-4">
              <DecisionDialogHeader tone="info" icon={BriefcaseIcon} title={t("jobTitle.title")} />
              <Field>
                <FieldLabel htmlFor="member-job-title">{t("jobTitle.label")}</FieldLabel>
                <Input
                  id="member-job-title"
                  autoComplete="organization-title"
                  maxLength={120}
                  placeholder={t("jobTitle.placeholder")}
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
              </Field>
              <DialogFooter variant="plain">
                <Button
                  size="lg"
                  prominence="secondary"
                  disabled={pending}
                  onClick={() => setTitling(false)}
                >
                  {t("jobTitle.cancel")}
                </Button>
                <Button size="lg" type="submit" pending={pending}>
                  {t("jobTitle.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export { MemberActions };
