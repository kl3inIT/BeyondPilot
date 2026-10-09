"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useNotify } from "@/hooks/use-notify";
import { setTaskModel, type ChatProvider, type ChatTask } from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import { ModelPicker, type ModelChoice } from "./model-picker";

/** The model a task uses. A choice is saved at once. */
function TaskModel({ task, providers }: { task: ChatTask; providers: ChatProvider[] }) {
  const t = useTranslations("Admin.ai.chat.tasks");
  const notify = useNotify();
  const router = useRouter();
  const [choice, setChoice] = useState<ModelChoice>({
    modelId: task.modelId ?? "",
    effort: task.reasoningEffort,
  });
  const [saving, setSaving] = useState(false);
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
      notify.error(chatError(error));
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  return (
    <ModelPicker
      label={t("pickerLabel", { task: name })}
      providers={providers}
      value={choice}
      disabled={saving}
      onChange={(next, modelName) => void save(next, modelName)}
    />
  );
}

export { TaskModel };
