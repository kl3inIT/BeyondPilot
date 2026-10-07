"use client";

import { useStore } from "@tanstack/react-form";
import { ArrowLeftIcon, AsteriskIcon, CircleAlertIcon, CircleDotIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import {
  previewEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  testEmailTemplate,
  type EmailPreview as Preview,
  type EmailTemplate,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { EmailPreview } from "./email-preview";
import { testFailures, testRefusals } from "./email-test-failures";
import { TestSend } from "./test-send";
import { TemplateCodeEditor, type TemplateCodeEditorHandle } from "./template-code-editor";

/** How long typing pauses before the preview is rendered again. */
const PREVIEW_DELAY = 400;

type Draft = { subject: string; body: string };

/** What keeps a field's draft from being saved, one line each. */
function Problems({ id, problems }: { id: string; problems: { message: string }[] }) {
  if (problems.length === 0) {
    return null;
  }
  return (
    <ul id={id} className="flex flex-col gap-1">
      {problems.map((problem) => (
        <li
          key={problem.message}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {problem.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * One kind of email's wording: the subject and the Markdown body with the variables the kind
 * offers, a preview with sample values that also says what keeps the draft from being saved, and
 * sending the draft to oneself. A stored template always renders, because the backend refuses one
 * that does not pass its checks.
 */
function EmailTemplateEditor({
  template,
  name,
  description,
  operatorEmail,
}: {
  template: EmailTemplate;
  name: string;
  description: string;
  /** Where a test goes unless another address is written. */
  operatorEmail: string;
}) {
  const t = useTranslations("Admin.email.editor");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const body = useRef<TemplateCodeEditorHandle>(null);
  const [current, setCurrent] = useState(template);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resetting, setResetting] = useState<"asking" | "pending" | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useAppForm({
    defaultValues: { subject: template.subject, body: template.body } satisfies Draft,
    validators: {
      onSubmit: z.object({
        subject: z.string().trim().min(1, t("required")).max(200),
        body: z.string().trim().min(1, t("required")).max(20000),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await saveEmailTemplate({
          path: { kind: template.kind },
          body: { subject: value.subject, body: value.body, version: current.version ?? null },
        });
        setCurrent(data);
        formApi.reset({ subject: data.subject, body: data.body });
        notify.success("Admin.email.editor.saved");
        router.refresh();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        notify.error(
          code === "NOTIFICATION_TEMPLATE_CHANGED"
            ? "Admin.email.editor.errors.changed"
            : code === "NOTIFICATION_TEMPLATE_INVALID"
              ? "Admin.email.editor.errors.invalid"
              : "Admin.email.editor.errors.unknown",
        );
      }
    },
  });

  const draft = useStore(form.store, (state) => state.values);
  const dirty = useStore(form.store, (state) => state.isDirty);
  const submitting = useStore(form.store, (state) => state.isSubmitting);

  // The preview follows the draft once typing pauses; an answer for an older draft is dropped.
  useEffect(() => {
    let stale = false;
    const timer = window.setTimeout(() => {
      previewEmailTemplate({ path: { kind: template.kind }, body: draft })
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
  }, [draft, template.kind]);

  async function reset() {
    setResetting("pending");
    try {
      const { data } = await resetEmailTemplate({ path: { kind: template.kind } });
      setCurrent(data);
      form.reset({ subject: data.subject, body: data.body });
      notify.success("Admin.email.editor.resetDone");
      router.refresh();
    } catch {
      notify.error("Admin.email.editor.errors.unknown");
    } finally {
      setResetting(null);
    }
  }

  async function test(to: string) {
    setTesting(true);
    try {
      const { data } = await testEmailTemplate({
        path: { kind: template.kind },
        body: draft,
        query: { to },
      });
      if (data.sent) {
        notify.success("Admin.email.editor.testSent", { email: data.recipient });
      } else {
        notify.error(testFailures[data.failure ?? "unavailable"]);
      }
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        (code === undefined ? undefined : testRefusals[code]) ??
          (code === "NOTIFICATION_TEMPLATE_INVALID"
            ? "Admin.email.editor.errors.invalid"
            : "Admin.email.editor.errors.unknown"),
      );
    } finally {
      setTesting(false);
    }
  }

  // The problems of each field with the words that explain each, kept while the preview is the same.
  const { problems, subjectProblems, bodyProblems } = useMemo(() => {
    const all = (preview?.problems ?? []).map((problem) => ({
      ...problem,
      message:
        problem.type === "unknown_variable"
          ? t("problems.unknownVariable", { variable: `{{${problem.variable ?? ""}}}` })
          : problem.type === "missing_variable"
            ? t("problems.missingVariable", { variable: `{{${problem.variable ?? ""}}}` })
            : t(`problems.${problem.type === "subject_line" ? "subjectLine" : "syntax"}`),
    }));
    return {
      problems: all,
      subjectProblems: all.filter((problem) => problem.field === "subject"),
      bodyProblems: all.filter((problem) => problem.field === "body"),
    };
  }, [preview, t]);

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {dirty && (
        <div
          role="status"
          className="sticky top-2 z-10 flex items-center gap-3 rounded-lg bg-foreground py-2 pr-2 pl-4 text-background"
        >
          <CircleDotIcon aria-hidden="true" className="size-4" />
          <p className="flex-1 text-sm font-medium">{t("unsaved")}</p>
          <Button prominence="secondary" size="sm" onClick={() => form.reset()}>
            {t("discard")}
          </Button>
          <Button type="submit" size="sm" pending={submitting}>
            {t("save")}
          </Button>
        </div>
      )}

      <Link
        href={siteRoutes.adminEmailTemplates}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {current.edited && <Badge variant="outline">{t("edited")}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          {current.edited && current.updatedBy && current.updatedAt && (
            <p className="text-xs text-muted-foreground">
              {t("lastEdited", {
                name: current.updatedBy,
                when: format.dateTime(new Date(current.updatedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}{" "}
              <Link
                href={siteRoutes.adminAuditLog}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("viewAudit")}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {current.edited && (
            <Button prominence="tertiary" size="sm" onClick={() => setResetting("asking")}>
              {t("reset")}
            </Button>
          )}
          <TestSend
            defaultTo={operatorEmail}
            pending={testing}
            disabled={problems.length > 0}
            onSend={(to) => void test(to)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <form.Field name="subject">
            {(field) => (
              <Field data-invalid={subjectProblems.length > 0 || undefined}>
                <FieldLabel id="email-subject-label" htmlFor="email-subject">
                  {t("subject")}
                </FieldLabel>
                <TemplateCodeEditor
                  id="email-subject"
                  labelledBy="email-subject-label"
                  singleLine
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  variables={current.variables}
                  problems={subjectProblems}
                  invalid={subjectProblems.length > 0}
                  describedBy="email-subject-problems"
                />
                <Problems id="email-subject-problems" problems={subjectProblems} />
              </Field>
            )}
          </form.Field>
          <form.Field name="body">
            {(field) => (
              <Field data-invalid={bodyProblems.length > 0 || undefined}>
                <FieldLabel id="email-body-label" htmlFor="email-body">
                  {t("body")}
                </FieldLabel>
                <TemplateCodeEditor
                  ref={body}
                  id="email-body"
                  labelledBy="email-body-label"
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  variables={current.variables}
                  problems={bodyProblems}
                  invalid={bodyProblems.length > 0}
                  describedBy="email-body-problems"
                />
                {bodyProblems.length > 0 ? (
                  <Problems id="email-body-problems" problems={bodyProblems} />
                ) : (
                  <FieldDescription id="email-body-problems">{t("bodyHint")}</FieldDescription>
                )}
              </Field>
            )}
          </form.Field>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("variables")}</p>
            <div className="flex flex-wrap gap-2">
              {current.variables.map((variable) => (
                <button
                  key={variable.name}
                  type="button"
                  onClick={() => body.current?.insert(variable.name)}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 font-mono text-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {variable.required && <AsteriskIcon aria-hidden="true" className="size-3" />}
                  {`{{${variable.name}}}`}
                  {variable.required && <span className="sr-only">{t("required")}</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("variablesHint")}</p>
          </div>
        </div>

        {preview && (
          <EmailPreview
            subject={preview.subject}
            html={preview.html}
            title={t("previewTitle", { name })}
            className="lg:w-140 lg:shrink-0"
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
      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title={t("resetConfirm.title")}
        description={t("resetConfirm.lead", { name })}
        note={t("resetConfirm.note")}
        confirmLabel={t("resetConfirm.confirm")}
        cancelLabel={t("resetConfirm.cancel")}
        tone="danger"
        pending={resetting === "pending"}
        onConfirm={() => void reset()}
      />
    </form>
  );
}

export { EmailTemplateEditor };
