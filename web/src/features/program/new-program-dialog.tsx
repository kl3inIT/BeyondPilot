"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { useFailureWords, useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { failedWith } from "@/lib/api/failure";
import { createProgram } from "@/lib/api/generated";
import { fieldOfPointer } from "@/lib/api/problem-fields";
import { useSiteHost } from "@/components/layout/use-public-site";
import { adminProgramRoute, siteRoutes } from "@/lib/site";

import { createProgramSchema, programTypes, slugify } from "./program-schemas";

/**
 * New program: the three things a program cannot do without. It starts as a draft that only
 * operators see, and the operator goes on to its Settings. The address follows the name until the
 * operator edits it.
 */
function NewProgramDialog({ locale }: { locale: string }) {
  const t = useTranslations("Admin.programs.create");
  const host = useSiteHost();
  const types = useTranslations("Program.type");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const words = useFailureWords();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: "",
      slug: "",
      type: "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: createProgramSchema(say) },
    onSubmit: async ({ value, formApi }) => {
      try {
        // The form is valid here, so its type is one of the program types.
        const { data } = await createProgram({ body: createProgramSchema(say).parse(value) });
        setOpen(false);
        router.push(getPathname({ href: adminProgramRoute(data.id), locale }));
      } catch (error) {
        if (failedWith(error, "PROGRAM_SLUG_TAKEN")) {
          setServerErrors(formApi, { fields: { slug: { message: words(error) } } });
        } else if (error instanceof ApiError && error.violations.length > 0) {
          setServerErrors(formApi, {
            fields: Object.fromEntries(
              error.violations.map((violation) => [
                fieldOfPointer(violation.pointer),
                { message: say("invalid") },
              ]),
            ),
          });
        } else {
          notify.failure(error);
        }
      }
    },
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("open")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            // The form starts again, so its address follows the name again.
            setSlugEdited(false);
          }
        }}
        form={form}
        title={t("title")}
        description={t("lead")}
        width="md"
        submitLabel={t("submit")}
        cancelLabel={t("cancel")}
      >
        <form.AppField
          name="name"
          listeners={{
            onChange: ({ value }) => {
              if (!slugEdited) {
                form.setFieldValue("slug", slugify(value));
              }
            },
          }}
        >
          {(field) => <field.TextField label={t("name")} autoComplete="off" maxLength={120} />}
        </form.AppField>
        <form.AppField name="slug" listeners={{ onChange: () => setSlugEdited(true) }}>
          {(field) => (
            <field.TextField
              label={t("slug")}
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              description={t("slugHint", {
                address: `${host}${siteRoutes.programs}/${field.state.value || "…"}`,
              })}
            />
          )}
        </form.AppField>
        <form.AppField name="type">
          {(field) => (
            <field.SelectField
              label={t("type")}
              placeholder={t("typePlaceholder")}
              options={programTypes.map((value) => ({ value, label: types(value) }))}
            />
          )}
        </form.AppField>
      </FormDialog>
    </>
  );
}

export { NewProgramDialog };
