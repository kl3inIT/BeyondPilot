"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { ArrowDownIcon, ArrowUpIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { EntryList } from "@/components/composites/entry-list";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  saveProgramQuestions,
  type ProgramQuestion,
  type ProgramQuestions as Questions,
} from "@/lib/api/generated";

import { programFormatter } from "./program-format";

const kinds = ["short_text", "long_text", "single_choice", "file", "link", "confirm"] as const;
type Kind = (typeof kinds)[number];

/** The most choices a question offers and the most questions a form asks (the backend's bounds). */
const MAX_CHOICES = 20;
const MAX_QUESTIONS = 20;

/** A question as the editor holds it: one not saved yet has no identifier. */
type Draft = Omit<ProgramQuestion, "id"> & { id?: string | null };

/**
 * The questions a program's application form asks, after what every application holds. They are
 * edited one at a time in a dialog, ordered here, and saved together; once the applications open
 * they are fixed, since an answer names its question.
 */
function ProgramQuestionsEditor({ programId, initial }: { programId: string; initial: Questions }) {
  const t = useTranslations("Admin.programs.questions");
  const format = programFormatter(useLocale());
  const notify = useNotify();
  const router = useRouter();
  const [questions, setQuestions] = useState<Draft[]>(initial.questions);
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(questions) !== JSON.stringify(initial.questions);

  function move(index: number, by: number) {
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    setQuestions(next);
  }

  async function save() {
    setPending(true);
    try {
      await saveProgramQuestions({
        path: { id: programId },
        body: { questions, version: initial.version },
      });
      notify.success("Admin.programs.questions.saved");
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        code === "PROGRAM_QUESTIONS_FIXED" ||
          code === "PROGRAM_CHANGED_MEANWHILE" ||
          code === "PROGRAM_CHOICES_REQUIRED"
          ? `Admin.programs.questions.errors.${code}`
          : "Admin.programs.errors.unknown",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{t("title")}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("lead")}</p>
      </div>

      {initial.fixed && (
        <p className="flex items-start gap-2 rounded-xl border bg-muted p-4 text-sm" role="status">
          <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {t("fixed", {
            opened: initial.opensAt
              ? format.dateTime(new Date(initial.opensAt), {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                })
              : "",
          })}
        </p>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ol className="flex flex-col border-b">
          {questions.map((question, index) => (
            <li
              key={question.id ?? `new-${index}`}
              className="flex items-center gap-3 border-t py-3"
            >
              <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{question.label}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    t(`kinds.${question.kind}`),
                    question.kind === "single_choice"
                      ? t("choiceCount", { count: question.options.length })
                      : null,
                    question.required ? null : t("optional"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {!question.id && <Badge variant="outline">{t("notSaved")}</Badge>}
              {!initial.fixed && (
                <div className="flex items-center gap-1">
                  <Button
                    prominence="tertiary"
                    size="sm"
                    aria-label={t("moveUp", { label: question.label })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    prominence="tertiary"
                    size="sm"
                    aria-label={t("moveDown", { label: question.label })}
                    disabled={index === questions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                  <Button
                    prominence="tertiary"
                    size="sm"
                    aria-label={t("editNamed", { label: question.label })}
                    onClick={() => setEditing({ index })}
                  >
                    {t("edit")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!initial.fixed && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            prominence="secondary"
            disabled={questions.length >= MAX_QUESTIONS}
            onClick={() => setEditing({ index: null })}
          >
            <PlusIcon aria-hidden="true" />
            {t("add")}
          </Button>
          <Button disabled={!dirty} pending={pending} onClick={() => void save()}>
            {t("save")}
          </Button>
          {dirty && <span className="text-sm text-muted-foreground">{t("unsaved")}</span>}
        </div>
      )}

      {editing && (
        <QuestionDialog
          value={editing.index === null ? null : questions[editing.index]}
          onClose={() => setEditing(null)}
          onSave={(question) => {
            const next = [...questions];
            if (editing.index === null) {
              next.push(question);
            } else {
              next[editing.index] = question;
            }
            setQuestions(next);
            setEditing(null);
          }}
          onDelete={
            editing.index === null
              ? undefined
              : () => {
                  setQuestions(questions.filter((_, index) => index !== editing.index));
                  setEditing(null);
                }
          }
        />
      )}
    </div>
  );
}

function QuestionDialog({
  value,
  onSave,
  onDelete,
  onClose,
}: {
  value: Draft | null;
  onSave: (question: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.programs.questions");
  const say = useTranslations("Form.errors");
  const schema = z
    .object({
      kind: z.enum(kinds),
      label: z
        .string()
        .trim()
        .min(1, say("required"))
        .max(300, say("tooLong", { max: 300 })),
      help: z.string().max(600, say("tooLong", { max: 600 })),
      required: z.boolean(),
      options: z.array(z.string()),
      maxLength: z.string().regex(/^\d*$/, say("invalid")),
    })
    .refine((question) => question.kind !== "single_choice" || question.options.length >= 2, {
      message: t("choicesRequired"),
      path: ["options"],
    });
  const form = useAppForm({
    defaultValues: {
      kind: (value?.kind ?? "long_text") as Kind,
      label: value?.label ?? "",
      help: value?.help ?? "",
      required: value?.required ?? true,
      options: value?.options ?? [],
      maxLength: value?.maxLength ? String(value.maxLength) : "",
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: ({ value: question }) => {
      const text = question.kind === "short_text" || question.kind === "long_text";
      onSave({
        id: value?.id ?? null,
        kind: question.kind,
        label: question.label.trim(),
        help: question.help.trim() || null,
        required: question.required,
        options: question.kind === "single_choice" ? question.options : [],
        maxLength: text && question.maxLength ? Number(question.maxLength) : null,
      });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{value ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <form.AppField name="kind">
            {(field) => (
              <field.SelectField
                label={t("kind")}
                options={kinds.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
              />
            )}
          </form.AppField>
          <form.AppField name="label">
            {(field) => (
              <field.TextareaField label={t("label")} maxLength={300} className="min-h-16" />
            )}
          </form.AppField>
          <form.AppField name="help">
            {(field) => (
              <field.TextField
                label={t("help")}
                optional
                maxLength={600}
                description={t("helpHint")}
              />
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.kind}>
            {(kind) => (
              <>
                {kind === "single_choice" && (
                  <form.Field name="options">
                    {(field) => (
                      <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                        <FieldLabel htmlFor="question-options">{t("options")}</FieldLabel>
                        <EntryList
                          id="question-options"
                          label={t("options")}
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder={t("optionsPlaceholder")}
                          max={MAX_CHOICES}
                          maxLength={160}
                          describedBy="question-options-hint"
                        />
                        <FieldDescription id="question-options-hint">
                          {t("optionsHint", { count: MAX_CHOICES })}
                        </FieldDescription>
                        {field.state.meta.errors.length > 0 && (
                          <FieldError>{t("choicesRequired")}</FieldError>
                        )}
                      </Field>
                    )}
                  </form.Field>
                )}
                {(kind === "short_text" || kind === "long_text") && (
                  <form.AppField name="maxLength">
                    {(field) => (
                      <field.TextField
                        label={t("maxLength")}
                        optional
                        inputMode="numeric"
                        description={t("maxLengthHint")}
                      />
                    )}
                  </form.AppField>
                )}
              </>
            )}
          </form.Subscribe>
          <form.AppField name="required">
            {(field) => <field.CheckboxField label={t("required")} />}
          </form.AppField>
          <DialogFooter className="sm:justify-between">
            {onDelete ? (
              <Button prominence="tertiary" tone="danger" onClick={onDelete}>
                <Trash2Icon aria-hidden="true" />
                {t("delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button prominence="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button type="submit">{value ? t("update") : t("addQuestion")}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ProgramQuestionsEditor };
