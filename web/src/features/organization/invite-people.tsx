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
import { ApiError } from "@/lib/api/client";
import {
  inviteOrganizationMember,
  type InvitationAllowance,
  type InviteMember,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

/** The addresses written in the field: one or several, apart by commas, semicolons or spaces. */
const addressesOf = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/** The refusals that say a limit was reached, after which no further address is tried. */
const limitCodes = ["ORGANIZATION_INVITATION_DAILY_LIMIT", "ORGANIZATION_INVITATION_OPEN_LIMIT"];

const reachedLimit = (error: unknown) =>
  error instanceof ApiError && limitCodes.includes(error.code ?? "");

type InvitePeopleProps = {
  organizationName: string;
  /** How many more invitations the organization may send today and keep open. */
  allowance: InvitationAllowance;
};

/**
 * Asks people to join the organization, as members or as owners. Each address gets its own
 * invitation; the person accepts after signing in. An address the backend refuses stays in the
 * field, so it can be corrected and sent again. Once a limit is reached the dialog says which,
 * instead of offering a form that cannot be sent.
 */
function InvitePeople({ organizationName, allowance }: InvitePeopleProps) {
  const t = useTranslations("Organization.members.invite");
  const roleName = useVocabulary("memberRole");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<InviteMember["role"]>("member");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // The day's limit is said first: only waiting helps, whatever is still open.
  const reached = allowance.leftToday === 0 ? "daily" : allowance.leftOpen === 0 ? "open" : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addresses = addressesOf(emails);
    if (addresses.length === 0) {
      setInvalid(true);
      return;
    }
    setPending(true);
    const refused: { address: string; error: unknown }[] = [];
    for (const [index, address] of addresses.entries()) {
      try {
        await inviteOrganizationMember({ body: { email: address, role } });
      } catch (error) {
        refused.push({ address, error });
        if (reachedLimit(error)) {
          // The rest would be refused for the same reason; they stay in the field.
          refused.push(...addresses.slice(index + 1).map((rest) => ({ address: rest, error })));
          break;
        }
      }
    }
    const sent = addresses.length - refused.length;
    if (sent > 0) {
      notify.success("Organization.done.invited", { count: sent });
      router.refresh();
    }
    if (refused.length > 0) {
      setEmails(refused.map((entry) => entry.address).join(", "));
      // A limit says nothing about the addresses; the dialog reads the new allowance and says it.
      setInvalid(!reachedLimit(refused[0].error));
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
          {reached ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("title", { name: organizationName })}</DialogTitle>
                <DialogDescription>
                  {t(`limit.${reached}.lead`, {
                    name: organizationName,
                    limit: reached === "daily" ? allowance.dailyLimit : allowance.openLimit,
                  })}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t(`limit.${reached}.note`)}</p>
              <DialogFooter>
                <Button prominence="secondary" onClick={() => setOpen(false)}>
                  {t("limit.close")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t("title", { name: organizationName })}</DialogTitle>
                <DialogDescription>
                  {t("lead", {
                    leftToday: allowance.leftToday,
                    dailyLimit: allowance.dailyLimit,
                    leftOpen: allowance.leftOpen,
                    openLimit: allowance.openLimit,
                  })}
                </DialogDescription>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export { InvitePeople };
