"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { z } from "zod";

import { LeaveGuard } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import {
  previewEmailTemplate,
  saveEmailAppearance,
  type EmailPreview as Preview,
  type EmailSettings,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { EmailPreview } from "./email-preview";

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** How long typing pauses before the preview is rendered again. */
const PREVIEW_DELAY = 300;

/** The email the preview shows: one every organization owner receives. */
const SAMPLE = "organization_approved";

/**
 * What every email shares: the colour of its links and buttons, and the note at its foot. The
 * preview shows a sample email in the colour and footer being edited, before they are saved.
 */
function EmailAppearanceForm({
  settings,
  sample,
}: {
  settings: EmailSettings;
  /** The sample email's wording, as it is stored. */
  sample: { subject: string; body: string };
}) {
  const t = useTranslations("Admin.email.appearance");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const router = useRouter();
  const [version, setVersion] = useState(settings.version);
  const [preview, setPreview] = useState<Preview | null>(null);

  const form = useAppForm({
    defaultValues: { accentColor: settings.accentColor, footer: settings.footer },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        accentColor: z.string().regex(HEX, t("colorInvalid")),
        footer: z.string().trim().min(1, say("required")).max(500),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await saveEmailAppearance({ body: { ...value, version } });
        setVersion(data.version);
        formApi.reset({ accentColor: data.accentColor, footer: data.footer });
        notify.success("Admin.email.appearance.saved");
        router.refresh();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        setServerErrors(formApi, {
          form: code === "NOTIFICATION_SETTINGS_CHANGED" ? t("changed") : t("unknown"),
          fields: {},
        });
      }
    },
  });
  const dirty = useStore(form.store, (state) => state.isDirty);
  const draft = useStore(form.store, (state) => state.values);

  // The preview follows the colour and footer being edited once typing pauses, saved or not. A colour that is not
  // yet six hex digits keeps the last preview; an answer for an older draft is dropped.
  useEffect(() => {
    if (!HEX.test(draft.accentColor)) {
      return;
    }
    let stale = false;
    const timer = window.setTimeout(() => {
      previewEmailTemplate({
        path: { kind: SAMPLE },
        body: { ...sample, appearance: { accentColor: draft.accentColor, footer: draft.footer } },
      })
        .then(({ data }) => {
          if (!stale) {
            setPreview(data);
          }
        })
        .catch(() => undefined);
    }, PREVIEW_DELAY);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [draft.accentColor, draft.footer, sample]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <Link
        href={siteRoutes.adminEmailTemplates}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <form
          noValidate
          className="flex flex-col gap-5 lg:w-96 lg:shrink-0"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppForm>
            <form.FormError />
          </form.AppForm>
          <form.Field name="accentColor">
            {(field) => {
              const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="accent-color">{t("color")}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t("colorPicker")}
                      value={HEX.test(field.state.value) ? field.state.value : "#000000"}
                      onChange={(event) => field.handleChange(event.target.value.toUpperCase())}
                      className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                    />
                    <Input
                      id="accent-color"
                      value={field.state.value}
                      maxLength={7}
                      spellCheck={false}
                      aria-invalid={invalid || undefined}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </div>
                  {invalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : (
                    <FieldDescription>{t("colorHint")}</FieldDescription>
                  )}
                </Field>
              );
            }}
          </form.Field>
          <form.AppField name="footer">
            {(field) => (
              <field.TextareaField
                label={t("footer")}
                maxLength={500}
                className="min-h-24"
                description={t("footerHint")}
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton className="self-start">{t("save")}</form.SubmitButton>
          </form.AppForm>
        </form>

        {preview && (
          <EmailPreview
            subject={preview.subject}
            html={preview.html}
            title={t("previewTitle")}
            className="min-w-0 flex-1"
          />
        )}
      </div>

      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </div>
  );
}

export { EmailAppearanceForm };
