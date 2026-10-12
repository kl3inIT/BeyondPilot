"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { useNotify } from "@/hooks/use-notify";
import { setTaskModel, type ChatProvider, type ChatTask } from "@/lib/api/generated";

import { ModelPicker, type ModelChoice } from "./model-picker";

/**
 * The model a task uses. A choice is asked again before it is saved: every run of the task from
 * then on uses it.
 */
function TaskModel({ task, providers }: { task: ChatTask; providers: ChatProvider[] }) {
  const t = useTranslations("Admin.ai.chat.tasks");
  const ask = useTranslations("Admin.ai.chat.tasks.confirm");
  const notify = useNotify();
  const router = useRouter();
  const [choice, setChoice] = useState<ModelChoice>({
    modelId: task.modelId ?? "",
    effort: task.reasoningEffort,
  });
  const [saving, setSaving] = useState(false);
  // The choice waiting for the operator to confirm it.
  const [asked, setAsked] = useState<{ choice: ModelChoice; modelName?: string } | null>(null);
  const name = t(`name.${task.task}`);

  async function save(next: ModelChoice, modelName: string | undefined) {
    const before = choice;
    setChoice(next);
    setSaving(true);
    try {
      await setTaskModel({
        path: { task: task.task },
        body: {
          modelId: next.modelId || null,
          reasoningEffort: next.effort,
          version: task.version,
        },
      });
      if (modelName) {
        notify.success("Admin.ai.chat.done.taskSet", { task: name, model: modelName });
      }
    } catch (error) {
      setChoice(before);
      notify.failure(error);
    } finally {
      setSaving(false);
      setAsked(null);
      router.refresh();
    }
  }

  return (
    <>
      <ModelPicker
        label={t("pickerLabel", { task: name })}
        providers={providers}
        value={choice}
        disabled={saving}
        onChange={(next, modelName) => setAsked({ choice: next, modelName })}
      />
      <ConfirmDialog
        open={asked !== null}
        onOpenChange={(open) => (open ? undefined : setAsked(null))}
        title={ask("title", { task: name })}
        description={ask("lead", { task: name })}
        confirmLabel={ask("save")}
        cancelLabel={ask("cancel")}
        pending={saving}
        onConfirm={() => asked && void save(asked.choice, asked.modelName)}
      >
        {asked && (
          <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            {ask("choice", {
              model: asked.modelName ?? t("choose"),
              effort: t(`effort.${asked.choice.effort}`),
            })}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

export { TaskModel };
