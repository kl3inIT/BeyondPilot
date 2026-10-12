"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailPlusIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { HelpPopover } from "@/components/composites/help-popover";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import { failedWith } from "@/lib/api/failure";
import {
  inviteOrganizationMember,
  type InvitationAllowance,
  type InviteMember,
} from "@/lib/api/generated";

/** The addresses written in the field: one or several, apart by commas, semicolons or spaces. */
const addressesOf = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

/** The refusals that say a limit was reached, after which no further address is tried. */
const reachedLimit = (error: unknown) =>
  failedWith(error, "ORGANIZATION_INVITATION_DAILY_LIMIT", "ORGANIZATION_INVITATION_OPEN_LIMIT") !==
  undefined;

/** The one refusal that is about how an address is written; the others are said by their own words alone. */
const badAddress = (error: unknown) => failedWith(error, "REQUEST_INVALID") !== undefined;

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
  // The day's limit is said first: only waiting helps, whatever is still open.
  const reached = allowance.leftToday === 0 ? "daily" : allowance.leftOpen === 0 ? "open" : null;

  const form = useAppForm({
    defaultValues: { emails: "", role: "member" as InviteMember["role"] },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        emails: z.string().refine((text) => addressesOf(text).length > 0, t("emailsInvalid")),
        role: z.enum(["owner", "member"]),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const addresses = addressesOf(value.emails);
      const refused: { address: string; error: unknown }[] = [];
      for (const [index, address] of addresses.entries()) {
        try {
          await inviteOrganizationMember({ body: { email: address, role: value.role } });
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
        formApi.setFieldValue("emails", refused.map((entry) => entry.address).join(", "));
        if (badAddress(refused[0].error)) {
          setServerErrors(formApi, { fields: { emails: { message: t("emailsInvalid") } } });
        }
        notify.failure(refused[0].error);
      } else {
        formApi.reset();
        setOpen(false);
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent showCloseButton={false} className="sm:max-w-120">
          {reached ? (
            <>
              <DecisionDialogHeader
                tone="info"
                icon={MailPlusIcon}
                title={t("title", { name: organizationName })}
                description={
                  <>
                    {t(`limit.${reached}.lead`, {
                      name: organizationName,
                      limit: reached === "daily" ? allowance.dailyLimit : allowance.openLimit,
                    })}
                  </>
                }
              />
              <p className="text-sm text-muted-foreground">{t(`limit.${reached}.note`)}</p>
              <DialogFooter variant="plain">
                <Button size="lg" prominence="secondary" onClick={() => setOpen(false)}>
                  {t("limit.close")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form
              id={form.formId}
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <DecisionDialogHeader
                tone="info"
                icon={MailPlusIcon}
                title={t("title", { name: organizationName })}
                description={t("lead", {
                  leftToday: allowance.leftToday,
                  dailyLimit: allowance.dailyLimit,
                  leftOpen: allowance.leftOpen,
                  openLimit: allowance.openLimit,
                })}
              />
              <FieldGroup>
                <form.AppField name="emails">
                  {(field) => (
                    <field.TextField
                      label={t("emails")}
                      inputMode="email"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      description={t("emailsHint")}
                    />
                  )}
                </form.AppField>
                <form.Field name="role">
                  {(field) => (
                    <Field>
                      <div className="flex items-center gap-1">
                        <FieldLabel htmlFor="invite-role">{t("role")}</FieldLabel>
                        <HelpPopover label={t("roleHelp")}>{t("note")}</HelpPopover>
                      </div>
                      <NativeSelect
                        id="invite-role"
                        className="w-full"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value as InviteMember["role"])
                        }
                      >
                        <NativeSelectOption value="member">{roleName("member")}</NativeSelectOption>
                        <NativeSelectOption value="owner">{roleName("owner")}</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  )}
                </form.Field>
              </FieldGroup>
              <DialogFooter variant="plain">
                <Button
                  size="lg"
                  prominence="secondary"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
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
