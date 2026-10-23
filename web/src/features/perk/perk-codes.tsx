"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { useAppForm } from "@/components/form/app-form";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { loadPerkCodes, type Perk } from "@/lib/api/generated";

/** The most codes one load takes, and the longest code, as the backend takes them. */
const limits = { codes: 5000, code: 200 } as const;

/** The codes pasted, one a line, without blanks or repeats. */
function codesOf(text: string) {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Loads the codes of a perk given as a list, one a line, as GenAI Fund received them from the
 * partner. Each team that gets the perk takes the next free one; a code the perk holds already is
 * skipped.
 */
function PerkCodes({ perk }: { perk: Perk }) {
  const t = useTranslations("Perk.manage.codes");
  const notify = useNotify();
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { codes: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        codes: z.string().refine(
          (text) => {
            const codes = codesOf(text);
            return (
              codes.length > 0 &&
              codes.length <= limits.codes &&
              codes.every((code) => code.length <= limits.code)
            );
          },
          t("invalid", { count: limits.codes, max: limits.code }),
        ),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await loadPerkCodes({
          path: { id: perk.id },
          body: { codes: codesOf(value.codes) },
        });
        notify.success("Perk.manage.codes.done", { added: data.added, free: data.free });
        formApi.reset();
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });

  return (
    <section aria-labelledby="perk-codes" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="perk-codes" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("held", { loaded: perk.codesLoaded, left: perk.codesLeft })}
        </p>
      </div>
      <form
        id={form.formId}
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="codes">
          {(field) => (
            <field.TextareaField
              label={t("label")}
              description={t("hint")}
              rows={6}
              className="font-mono"
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton prominence="secondary" className="self-start">
            {t("submit")}
          </form.SubmitButton>
        </form.AppForm>
      </form>
    </section>
  );
}

export { PerkCodes };
