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
import { inviteOrganizationMember, type InviteMember } from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

/** The addresses written in the field: one or several, apart by commas, semicolons or spaces. */
const addressesOf = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/**
 * Asks people to join the organization, as members or as owners. Each address gets its own
 * invitation; the person accepts after signing in. An address the backend refuses stays in the
 * field, so it can be corrected and sent again.
 */
function InvitePeople({ organizationName }: { organizationName: string }) {
  const t = useTranslations("Organization.members.invite");
  const roleName = useVocabulary("memberRole");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteMember["role"]>("member");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addresses = addressesOf(emails);
    if (addresses.length === 0) {
      setInvalid(true);
      return;
    }
    setPending(true);
    const refused: { address: string; error: unknown }[] = [];
    for (const address of addresses) {
      try {
        await inviteOrganizationMember({ body: { email: address, role } });
      } catch (error) {
        refused.push({ address, error });
      }
    }
    const sent = addresses.length - refused.length;
    if (sent > 0) {
      notify.success("Organization.done.invited", { count: sent });
      router.refresh();
    }
    if (refused.length > 0) {
      setEmails(refused.map((entry) => entry.address).join(", "));
      setInvalid(true);
      notify.error(organizationError(refused[0].error));
    } else {
      setEmails("");
      setInvalid(false);
      setOpen(false);
    }
    setPending(false);
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-120">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("title", { name: organizationName })}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="invite-emails">{t("emails")}</FieldLabel>
                <Input
                  id="invite-emails"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("emailsPlaceholder")}
                  value={emails}
                  onChange={(event) => setEmails(event.target.value)}
                  aria-invalid={invalid || undefined}
                />
                {invalid && <FieldError>{t("emailsInvalid")}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">{t("role")}</FieldLabel>
                <NativeSelect
                  id="invite-role"
                  className="w-full"
                  value={role}
                  onChange={(event) => setRole(event.target.value as InviteMember["role"])}
                >
                  <NativeSelectOption value="member">{roleName("member")}</NativeSelectOption>
                  <NativeSelectOption value="owner">{roleName("owner")}</NativeSelectOption>
                </NativeSelect>
              </Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">{t("note")}</p>
            <DialogFooter>
              <Button prominence="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="lg" pending={pending}>
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { InvitePeople };
