"use client";

import { useStore } from "@tanstack/react-form";
import { CircleAlertIcon, CircleDotIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { useAppForm } from "@/components/form/app-form";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { FailureWords } from "@/lib/api/failure";
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
import { testFailures } from "./email-test-failures";
import { TestSend } from "./test-send";
import { TemplateCodeEditor, type TemplateCodeEditorHandle } from "./template-code-editor";
import { tagFaults } from "./template-tags";

/** How long typing pauses before the preview is rendered again. */
const PREVIEW_DELAY = 400;

type Draft = { subject: string; body: string };

/**
 * What keeps a field's draft from being saved, one line each. The element is always there, empty
 * while nothing is wrong: the field's `aria-describedby` then always names something, and a problem
 * the preview finds while the person types is said by the live region it arrives in.
 */
function Problems({ id, problems }: { id: string; problems: { message: string }[] }) {
  return (
    <div id={id} aria-live="polite">
      {problems.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
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
      )}
    </div>
  );
}

/** The look of a variable or a condition in the lists under the body: a chip that puts it in the text. */
const chip =
  "inline-flex min-h-6 max-w-full items-center rounded-md border bg-muted px-2 py-0.5 text-left font-mono text-xs break-all outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * One kind of email's wording: the subject and the Markdown body with the variables the kind
 * offers, a preview with sample values that also says what keeps the draft from being saved, and
 * sending the draft to oneself. A stored template always renders, because the backend refuses one
 * that does not pass its checks. Under the body the variables are listed with the value the preview
 * puts in their place, and apart from them the conditions, which show or hide a piece of the text.
 */
/** What did not happen, for a refusal that has no words of its own. */
const editorWords = {
  otherwise: "Admin.email.editor.errors.unknown",
} as const satisfies FailureWords;

function EmailTemplateEditor({
  template,
  name,
  description,
  operatorEmail,
}: {
  template: EmailTemplate;
  name: string;
  /** What the name does not say about the email; most kinds have none. */
  description?: string;
  /** Where a test goes unless another address is written. */
  operatorEmail: string;
}) {
  const t = useTranslations("Admin.email.editor");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const body = useRef<TemplateCodeEditorHandle>(null);
  const [current, setCurrent] = useState(template);
  // The preview, with the draft it was made for: its problems are found in that text.
  const [preview, setPreview] = useState<(Preview & { of: Draft }) | null>(null);
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
        notify.failure(error, editorWords);
      }
    },
  });

  const draft = useStore(form.store, (state) => state.values);
  // A value changed and then put back is no change: there is nothing to save or to lose.
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const submitting = useStore(form.store, (state) => state.isSubmitting);

  // The preview follows the draft once typing pauses; an answer for an older draft is dropped.
  useEffect(() => {
    let stale = false;
    const timer = window.setTimeout(() => {
      previewEmailTemplate({ path: { kind: template.kind }, body: draft })
        .then(({ data }) => {
          if (!stale) {
            setPreview({ ...data, of: draft });
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
    } catch (error) {
      notify.failure(error, editorWords);
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
      notify.failure(error, editorWords);
    } finally {
      setTesting(false);
    }
  }

  // The problems of each field with the words that explain each, kept while the preview is the same.
  // The backend says a text is badly written without saying where; the place and what is wrong
  // there are found in the text itself, and said in general words when nothing is found.
  const { problems, subjectProblems, bodyProblems } = useMemo(() => {
    const all = (preview?.problems ?? []).flatMap((problem) => {
      if (problem.type === "syntax") {
        const faults = tagFaults(preview?.of[problem.field] ?? "").map((fault) => {
          const words = t(`problems.${fault.kind}`, {
            tag: fault.tag ?? "",
            name: fault.name ?? "",
          });
          return {
            ...problem,
            from: fault.from,
            to: fault.to,
            // The subject is one line, so only the body says which.
            message:
              problem.field === "body"
                ? t("problems.atLine", { line: fault.line, problem: words })
                : words,
          };
        });
        // The same words twice are one line under the field.
        const said = new Set<string>();
        const told = faults.filter((fault) => !said.has(fault.message) && said.add(fault.message));
        return told.length > 0 ? told : [{ ...problem, message: t("problems.syntax") }];
      }
      return [
        {
          ...problem,
          message:
            problem.type === "unknown_variable"
              ? t("problems.unknownVariable", { variable: `{{${problem.variable ?? ""}}}` })
              : problem.type === "missing_variable"
                ? t("problems.missingVariable", { variable: `{{${problem.variable ?? ""}}}` })
                : t("problems.subjectLine"),
        },
      ];
    });
    return {
      problems: all,
      subjectProblems: all.filter((problem) => problem.field === "subject"),
      bodyProblems: all.filter((problem) => problem.field === "body"),
    };
  }, [preview, t]);

  // The backend says which variables are printed and which only show or hide a passage.
  const values = current.variables.filter((variable) => variable.kind === "value");
  const conditions = current.variables.filter((variable) => variable.kind === "switch");
  // What a switch shows text for is written per switch; one without words is said in general.
  const switchWords = (name: string) => {
    const key = `switches.${name}` as "switches.other";
    return t.has(key) ? key : "switches.other";
  };

  return (
    <form
      id={form.formId}
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
          <p className="flex-1 text-sm font-medium">
            {problems.length > 0 ? t("fixToSave", { count: problems.length }) : t("unsaved")}
          </p>
          <Button prominence="secondary" size="sm" onClick={() => form.reset()}>
            {t("discard")}
          </Button>
          {/* Wording with a problem is refused by the backend, so it is not offered for saving. */}
          <Button type="submit" size="sm" pending={submitting} disabled={problems.length > 0}>
            {t("save")}
          </Button>
        </div>
      )}

      <AdminPageHeader
        back={{ href: siteRoutes.adminEmailTemplates, label: t("back") }}
        title={name}
        badges={current.edited && <Badge variant="outline">{t("edited")}</Badge>}
        lead={
          <div className="flex flex-col gap-1">
            {description && <p>{description}</p>}
            {/* The wording has one language: an operator reading Vietnamese edits the English everyone gets. */}
            <p>{t("sentInEnglish")}</p>
            {current.edited && current.updatedBy && current.updatedAt && (
              <p className="text-xs">
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
        }
        actions={
          <>
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
            {problems.length > 0 && (
              <p className="w-full text-xs text-muted-foreground">{t("testAfterFix")}</p>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <form.Field name="subject">
            {(field) => (
              <Field data-invalid={subjectProblems.length > 0 || undefined}>
                <FieldLabel id="email-subject-label" htmlFor="email-subject">
                  {t("subject")}
                </FieldLabel>
                {/* One child of the field, so the empty list of problems adds no gap under the editor. */}
                <div className="flex flex-col">
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
                </div>
              </Field>
            )}
          </form.Field>
          <form.Field name="body">
            {(field) => (
              <Field data-invalid={bodyProblems.length > 0 || undefined}>
                <FieldLabel id="email-body-label" htmlFor="email-body">
                  {t("body")}
                </FieldLabel>
                <div className="flex flex-col">
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
                    // The hint gives way to the problems; each has an id of its own.
                    describedBy={
                      bodyProblems.length > 0 ? "email-body-problems" : "email-body-hint"
                    }
                  />
                  <Problems id="email-body-problems" problems={bodyProblems} />
                </div>
                {bodyProblems.length === 0 && (
                  <FieldDescription id="email-body-hint">{t("bodyHint")}</FieldDescription>
                )}
                {/* What the preview shows and the body does not hold (notification/layout.html). */}
                <FieldDescription>{t("frame")}</FieldDescription>
              </Field>
            )}
          </form.Field>
          <section aria-labelledby="email-variables" className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id="email-variables" className="text-sm font-medium">
                {t("variables")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("variablesHint")}</p>
            </div>
            <ul className="flex flex-col divide-y rounded-lg border">
              {values.map((variable) => (
                <li
                  key={variable.name}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => body.current?.insert(variable.name)}
                    className={chip}
                  >
                    {`{{${variable.name}}}`}
                  </button>
                  {variable.sample && (
                    <span className="line-clamp-2 min-w-0 flex-1 basis-40 text-sm break-words text-muted-foreground">
                      <span className="sr-only">{t("example")} </span>
                      {variable.sample}
                    </span>
                  )}
                  {variable.required && (
                    <span className="ml-auto text-xs font-medium">{t("mustAppear")}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {conditions.length > 0 && (
            <section aria-labelledby="email-conditions" className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="email-conditions" className="text-sm font-medium">
                  {t("conditions")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("conditionsHint")}</p>
              </div>
              <ul className="flex flex-col divide-y rounded-lg border">
                {conditions.map((variable) => (
                  <li
                    key={variable.name}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-1.5"
                  >
                    <button
                      type="button"
                      aria-label={t("wrap", { name: variable.name })}
                      onClick={() => body.current?.wrap(variable.name)}
                      className={chip}
                    >
                      {variable.name}
                    </button>
                    <span className="min-w-0 flex-1 basis-40 text-sm text-muted-foreground">
                      {t(switchWords(variable.name))}
                    </span>
                    {(variable.sample === "true" || variable.sample === "false") && (
                      <span className="ml-auto text-xs font-medium">
                        {t(variable.sample === "true" ? "previewOn" : "previewOff")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {preview && (
          <EmailPreview
            subject={preview.subject}
            html={preview.html}
            title={t("previewTitle", { name })}
            behind={problems.length > 0 ? t("previewBehind") : undefined}
            className="xl:w-140 xl:shrink-0"
          />
        )}
      </div>

      <LeaveGuard
        active={dirty}
        back
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title={t("resetConfirm.title")}
        description={t("resetConfirm.note")}
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
