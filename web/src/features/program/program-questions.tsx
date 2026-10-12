"use client";

import { revalidateLogic } from "@tanstack/react-form";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { EntryList } from "@/components/composites/entry-list";
import { FormDialog } from "@/components/composites/form-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { cn } from "@/lib/utils";
import {
  saveProgramQuestions,
  type ProgramQuestion,
  type ProgramQuestions as Questions,
} from "@/lib/api/generated";

import { programFormatter } from "./program-format";
import { moved, type Keyed } from "./program-question-order";

const kinds = [
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "file",
  "link",
  "confirm",
] as const;
type Kind = (typeof kinds)[number];

/** Whether a question of this kind is answered from choices the operator writes. */
const offersChoices = (kind: Kind) => kind === "single_choice" || kind === "multi_choice";

/** How long before the opening the line that says when the questions lock stands out. */
const LOCK_WARNING_MS = 48 * 60 * 60 * 1000;

/** The most choices a question offers and the most questions a form asks (the backend's bounds). */
const MAX_CHOICES = 20;
const MAX_QUESTIONS = 20;

/** A question as the editor holds it: one not saved yet has no identifier. */
type Draft = Omit<ProgramQuestion, "id"> & { id?: string | null };

/**
 * The questions a program's application form asks, after what every application holds. They are
 * edited one at a time in a dialog, ordered here, and saved together; once the applications open
 * they are fixed, since an answer names its question. The page says when that happens before it
 * does, and stands it out in the last two days.
 */
function ProgramQuestionsEditor({ programId, initial }: { programId: string; initial: Questions }) {
  const t = useTranslations("Admin.programs.questions");
  const format = programFormatter(useLocale());
  const notify = useNotify();
  const router = useRouter();
  // Each row keeps one key for as long as the editor is open, so a question that moves, or one not
  // saved yet, stays the same row to React and to the focus.
  const [rows, setRows] = useState<Keyed<Draft>[]>(() =>
    initial.questions.map((question, index) => ({
      key: question.id ?? `stored-${index}`,
      question,
    })),
  );
  const added = useRef(0);
  const questions = rows.map((row) => row.question);
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Date.now());
  // The row a move button moved, and which way: the focus goes with it, and the move is said.
  const [lastMove, setLastMove] = useState<{ key: string; by: number; said: string } | null>(null);
  const listId = useId();
  const dirty = JSON.stringify(questions) !== JSON.stringify(initial.questions);
  const opens = initial.opensAt ? new Date(initial.opensAt) : null;
  const when = (date: Date) =>
    format.dateTime(date, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

  function move(index: number, by: number) {
    const row = rows[index];
    setRows(moved(rows, index, by));
    setLastMove({
      key: row.key,
      by,
      said: t("moved", {
        label: row.question.label,
        position: index + by + 1,
        count: rows.length,
      }),
    });
  }

  // The button that moved a question moves with it, so pressing it again moves the same question
  // on. At either end of the list that button is switched off, and the other one takes the focus.
  useEffect(() => {
    if (!lastMove) {
      return;
    }
    const button = (way: "up" | "down") =>
      document.getElementById(`${listId}-${lastMove.key}-${way}`) as HTMLButtonElement | null;
    const same = button(lastMove.by < 0 ? "up" : "down");
    const other = button(lastMove.by < 0 ? "down" : "up");
    (same && !same.disabled ? same : other)?.focus();
  }, [lastMove, listId]);

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
      notify.failure(error);
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

      {initial.fixed ? (
        <div
          className="flex items-start gap-2 rounded-xl border bg-muted p-4 text-sm"
          role="status"
        >
          <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p>{t("fixed", { opened: opens ? when(opens) : "" })}</p>
            <p className="text-muted-foreground">{t("fixedStill")}</p>
          </div>
        </div>
      ) : (
        <p
          className={cn(
            "flex items-start gap-2 rounded-xl border p-4 text-sm",
            opens && opens.getTime() - now < LOCK_WARNING_MS && "border-warning bg-warning/10",
          )}
        >
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {opens ? t("locks", { opens: when(opens) }) : t("locksUnset")}
        </p>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ol className="flex flex-col border-b">
          {rows.map(({ key, question }, index) => (
            // Where the row is too narrow for both, the question keeps its line and its controls
            // go under it.
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3">
              <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                <span className="text-sm font-medium break-words">{question.label}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    t(`kinds.${question.kind}`),
                    offersChoices(question.kind)
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
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    id={`${listId}-${key}-up`}
                    prominence="tertiary"
                    size="sm"
                    aria-label={t("moveUp", { label: question.label })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    id={`${listId}-${key}-down`}
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
        <>
          <div>
            <Button
              prominence="secondary"
              disabled={questions.length >= MAX_QUESTIONS}
              onClick={() => setEditing({ index: null })}
            >
              <PlusIcon aria-hidden="true" />
              {t("add")}
            </Button>
          </div>
          {/* A move is said to a screen reader, which does not see the row change place. */}
          <p role="status" className="sr-only">
            {lastMove?.said}
          </p>
          {/*
            Save, as on Settings: with unsaved changes it stays at the foot of the screen, so it is
            reached without scrolling past a long list.
          */}
          <div
            className={
              dirty
                ? "sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t bg-background px-4 py-3 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
                : "flex flex-wrap items-center justify-end gap-3"
            }
          >
            {dirty && <span className="text-sm text-muted-foreground">{t("unsaved")}</span>}
            <Button disabled={!dirty} pending={pending} onClick={() => void save()}>
              {t("save")}
            </Button>
          </div>
          <LeaveGuard
            active={dirty && !pending}
            back
            title={t("leave.title")}
            description={t("leave.lead")}
            leaveLabel={t("leave.leave")}
            stayLabel={t("leave.stay")}
          />
        </>
      )}

      {editing && (
        <QuestionDialog
          value={editing.index === null ? null : questions[editing.index]}
          onClose={() => setEditing(null)}
          onSave={(question) => {
            const next = [...rows];
            if (editing.index === null) {
              added.current += 1;
              next.push({ key: `new-${added.current}`, question });
            } else {
              next[editing.index] = { key: next[editing.index].key, question };
            }
            setRows(next);
            setEditing(null);
          }}
          onDelete={
            editing.index === null
              ? undefined
              : () => {
                  setRows(rows.filter((_, index) => index !== editing.index));
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
    .refine((question) => !offersChoices(question.kind) || question.options.length >= 2, {
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
        options: offersChoices(question.kind) ? question.options : [],
        maxLength: text && question.maxLength ? Number(question.maxLength) : null,
      });
    },
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={value ? t("editTitle") : t("addTitle")}
      width="lg"
      submitLabel={value ? t("update") : t("addQuestion")}
      cancelLabel={t("cancel")}
      aside={
        onDelete && (
          <Button prominence="tertiary" tone="danger" onClick={onDelete}>
            <Trash2Icon aria-hidden="true" />
            {t("delete")}
          </Button>
        )
      }
    >
      <form.AppField name="kind">
        {(field) => (
          <field.SelectField
            label={t("kind")}
            options={kinds.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
          />
        )}
      </form.AppField>
      <form.AppField name="label">
        {(field) => <field.TextareaField label={t("label")} maxLength={300} className="min-h-16" />}
      </form.AppField>
      <form.AppField name="help">
        {(field) => (
          <field.TextField label={t("help")} optional maxLength={600} description={t("helpHint")} />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.kind}>
        {(kind) => (
          <>
            {offersChoices(kind) && (
              <form.Field name="options">
                {(field) => {
                  // Too few choices: the input that adds one is marked and takes the focus, with
                  // the reason tied to it.
                  const invalid = field.state.meta.errors.length > 0;
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor="question-options">{t("options")}</FieldLabel>
                      <EntryList
                        id="question-options"
                        label={t("options")}
                        value={field.state.value}
                        onChange={field.handleChange}
                        placeholder={t("optionsPlaceholder")}
                        max={MAX_CHOICES}
                        maxLength={160}
                        invalid={invalid}
                        describedBy={
                          invalid
                            ? "question-options-hint question-options-error"
                            : "question-options-hint"
                        }
                      />
                      <FieldDescription id="question-options-hint">
                        {t("optionsHint", { count: MAX_CHOICES })}
                      </FieldDescription>
                      {invalid && (
                        <FieldError id="question-options-error">{t("choicesRequired")}</FieldError>
                      )}
                    </Field>
                  );
                }}
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
    </FormDialog>
  );
}

export { ProgramQuestionsEditor };
