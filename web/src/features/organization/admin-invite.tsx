"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import { inviteAdminOrganizationMember, type InviteMember } from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

/**
 * Asks one address to own or join any organization. An operator's invitations stay out of the
 * organization's daily and open limits, so the dialog shows none.
 */
function AdminInvite({ organization }: { organization: { id: string; name: string } }) {
  const t = useTranslations("Admin.organizations.people.invite");
  const roleName = useVocabulary("memberRole");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteMember["role"]>("owner");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address.includes("@")) {
      setInvalid(true);
      return;
    }
    setPending(true);
    try {
      await inviteAdminOrganizationMember({
        path: { id: organization.id },
        body: { email: address, role },
      });
      notify.success("Organization.done.invited", { count: 1 });
      setEmail("");
      setInvalid(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setInvalid(true);
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("open")}</Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-120">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle size="lg">{t("title", { name: organization.name })}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="admin-invite-email">{t("email")}</FieldLabel>
                <Input
                  id="admin-invite-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={invalid || undefined}
                />
                {invalid && <FieldError>{t("emailInvalid")}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-invite-role">{t("role")}</FieldLabel>
                <NativeSelect
                  id="admin-invite-role"
                  className="w-full"
                  value={role}
                  onChange={(event) => setRole(event.target.value as InviteMember["role"])}
                >
                  <NativeSelectOption value="owner">{roleName("owner")}</NativeSelectOption>
                  <NativeSelectOption value="member">{roleName("member")}</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">{t("note")}</p>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={pending}>
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminInvite };
