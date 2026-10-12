"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import {
  createAdminSolution,
  listAdminSolutionOrganizations,
  type AdminSolutionOrganizationOption,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { solutionError } from "./solution-errors";

/**
 * Starts a solution for an organization, as an operator. The organization is one GenAI Fund approved
 * and the name is what the draft is called; it opens in the editor, which the operator publishes from.
 */
function CreateAdminSolution() {
  const t = useTranslations("Admin.solutions.create");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<AdminSolutionOrganizationOption[] | null>(
    null,
  );

  const form = useAppForm({
    defaultValues: { organizationId: "", name: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        organizationId: z.string().min(1, t("organizationRequired")),
        name: z.string().refine((text) => text.trim() !== "", t("nameRequired")),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        const { data } = await createAdminSolution({
          body: { organizationId: value.organizationId, name: value.name },
        });
        router.push(getPathname({ href: `${siteRoutes.adminSolutions}/${data.id}/edit`, locale }));
      } catch (error) {
        notify.error(solutionError(error));
        return;
      }
      // The dialog stays pending until the editor arrives, so a second press cannot create twice.
      await new Promise(() => undefined);
    },
  });

  async function show() {
    setOpen(true);
    if (organizations !== null) {
      return;
    }
    try {
      const { data } = await listAdminSolutionOrganizations({ query: {} });
      setOrganizations(data);
    } catch (error) {
      notify.error(solutionError(error));
      setOpen(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={show}>
        <PlusIcon aria-hidden="true" />
        {t("action")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("title")}
        submitLabel={t("submit")}
        cancelLabel={t("cancel")}
      >
        <form.AppField name="organizationId">
          {(field) => (
            <field.ComboboxField
              label={t("organization")}
              requiredMark
              placeholder={t("organizationPlaceholder")}
              options={(organizations ?? []).map(({ id, name }) => ({ value: id, label: name }))}
              description={
                organizations?.length === 0 ? (
                  <span className="text-destructive">{t("noOrganizations")}</span>
                ) : undefined
              }
            />
          )}
        </form.AppField>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label={t("name")} requiredMark aria-required maxLength={120} />
          )}
        </form.AppField>
      </FormDialog>
    </>
  );
}

export { CreateAdminSolution };
