"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { createSolution } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

type NewSolutionFormProps = {
  onCancel: () => void;
  /**
   * Set when something else takes the new draft on, such as a proposal that opens the editor in a dialog:
   * it is called with the solution's id instead of going to the editor's page.
   */
  onCreated?: (id: string) => void;
};

/**
 * The form that names a new solution. It is created as a draft and opens in its editor, or is
 * handed to `onCreated`.
 */
function useNewSolutionForm(onCreated?: (id: string) => void) {
  const t = useTranslations("Solution.mine.create");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();

  return useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        name: z.string().refine((text) => text.trim() !== "", t("nameRequired")),
      }),
    },
    onSubmit: async ({ value }) => {
      try {
        const { data } = await createSolution({ body: { name: value.name } });
        if (onCreated) {
          onCreated(data.id);
        } else {
          router.push(getPathname({ href: `${siteRoutes.workspaceSolutions}/${data.id}`, locale }));
        }
      } catch (error) {
        notify.failure(error);
        return;
      }
      // The form stays pending until the editor arrives, so a second press cannot create twice.
      await new Promise(() => undefined);
    },
  });
}

/**
 * Asks for the name of a new solution, inside a dialog that is someone else's: the frame is drawn
 * here, by hand, because the popup that shows it swaps it with its own content.
 */
function NewSolutionForm({ onCancel, onCreated }: NewSolutionFormProps) {
  const t = useTranslations("Solution.mine.create");
  const form = useNewSolutionForm(onCreated);
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <form
      id={form.formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        // React passes the event to the page's own form, when the dialog was opened from one.
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("lead")}</DialogDescription>
      </DialogHeader>
      <form.AppField name="name">
        {(field) => <field.TextField label={t("name")} maxLength={120} />}
      </form.AppField>
      <DialogFooter>
        <Button prominence="secondary" disabled={pending} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" pending={pending}>
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The button that starts a solution from its name, asked in a dialog. */
function CreateSolution() {
  const t = useTranslations("Solution.mine.create");
  const [open, setOpen] = useState(false);
  const form = useNewSolutionForm();

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("title")}
        description={t("lead")}
        submitLabel={t("submit")}
        cancelLabel={t("cancel")}
      >
        <form.AppField name="name">
          {(field) => <field.TextField label={t("name")} maxLength={120} />}
        </form.AppField>
      </FormDialog>
    </>
  );
}

export { CreateSolution, NewSolutionForm };
