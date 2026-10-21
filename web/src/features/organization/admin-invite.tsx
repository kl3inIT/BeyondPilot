"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailPlusIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import { failedWith } from "@/lib/api/failure";
import { inviteAdminOrganizationMember, type InviteMember } from "@/lib/api/generated";

type AdminInviteProps = {
  organization: { id: string; name: string };
};

/**
 * Asks one address to own or join any organization. An operator's invitations stay out of the
 * organization's daily and open limits, so the dialog shows none.
 */
function AdminInvite({ organization }: AdminInviteProps) {
  const t = useTranslations("Admin.organizations.people.invite");
  const roleName = useVocabulary("memberRole");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useAppForm({
    defaultValues: { email: "", role: "owner" as InviteMember["role"] },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        email: z
          .string()
          .refine((text) => z.email().safeParse(text.trim()).success, t("emailInvalid")),
        role: z.enum(["owner", "member"]),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await inviteAdminOrganizationMember({
          path: { id: organization.id },
          body: { email: value.email.trim(), role: value.role },
        });
        notify.success("Organization.done.invited", { count: 1 });
        setOpen(false);
        router.refresh();
      } catch (error) {
        // Only a badly written address is the field's to say; any other refusal has its own words.
        if (failedWith(error, "REQUEST_INVALID")) {
          setServerErrors(formApi, { fields: { email: { message: t("emailInvalid") } } });
        }
        notify.failure(error);
      }
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("open")}</Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("title", { name: organization.name })}
        mark={{ tone: "info", icon: MailPlusIcon }}
        width="lg"
        submitLabel={t("send")}
        cancelLabel={t("cancel")}
      >
        <FieldGroup>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label={t("email")}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                maxLength={254}
              />
            )}
          </form.AppField>
          <form.Field name="role">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="admin-invite-role">{t("role")}</FieldLabel>
                <NativeSelect
                  id="admin-invite-role"
                  className="w-full"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value as InviteMember["role"])
                  }
                >
                  <NativeSelectOption value="owner">{roleName("owner")}</NativeSelectOption>
                  <NativeSelectOption value="member">{roleName("member")}</NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </FieldGroup>
      </FormDialog>
    </>
  );
}

export { AdminInvite };
