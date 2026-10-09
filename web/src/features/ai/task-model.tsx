"use client";

import { BrainIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  ModelSelectorContent,
  ModelSelectorEffort,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorRoot,
  ModelSelectorSearch,
  ModelSelectorTrigger,
  ModelSelectorValue,
  type ModelOption,
} from "@/components/assistant-ui/elements/model-selector";
import { useNotify } from "@/hooks/use-notify";
import { setTaskModel, type ChatProvider, type ChatTask } from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import { ModelLogo } from "./model-logo";

const levels = ["off", "low", "medium", "high"] as const;

type Effort = ChatTask["reasoningEffort"];

/**
 * The model a task uses, on assistant-ui's Model selector: search, one group per provider, and for
 * a model that reasons the level it reasons at. A choice is saved at once. Only a model whose
 * provider is switched on and has a key can be chosen.
 */
function TaskModel({ task, providers }: { task: ChatTask; providers: ChatProvider[] }) {
  const t = useTranslations("Admin.ai.chat.tasks");
  const notify = useNotify();
  const router = useRouter();
  const [choice, setChoice] = useState({
    modelId: task.modelId ?? "",
    effort: task.reasoningEffort,
  });
  const [saving, setSaving] = useState(false);
  const name = t(`name.${task.task}`);
  const efforts = levels.map((level) => ({ id: level, name: t(`effort.${level}`) }));
  const groups = providers
    .filter((provider) => provider.enabled && provider.hasKey)
    .map((provider) => ({
      provider,
      // A task that sends pictures takes only a model that reads them.
      models: provider.models.filter((model) => task.task !== "document_reading" || model.vision),
    }))
    .filter((group) => group.models.length > 0)
    .map(({ provider, models }) => ({
      provider,
      options: models.map((model): ModelOption => ({
        id: model.id,
        name: model.displayName,
        description: model.modelName !== model.displayName ? model.modelName : undefined,
        icon: <ModelLogo modelName={model.modelName} />,
        keywords: [model.modelName, provider.name],
        efforts: model.reasoning ? efforts : undefined,
      })),
    }));
  const options = groups.flatMap((group) => group.options);
  const selected = options.find((option) => option.id === choice.modelId);

  async function save(next: { modelId: string; effort: Effort }) {
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
      const model = options.find((option) => option.id === next.modelId);
      if (model) {
        notify.success("Admin.ai.chat.done.taskSet", { task: name, model: model.name });
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
    <ModelSelectorRoot
      models={options}
      value={choice.modelId}
      onValueChange={(modelId) => {
        if (modelId !== choice.modelId) {
          void save({ ...choice, modelId });
        }
      }}
      effort={choice.effort}
      onEffortChange={(effort) => {
        if (effort !== choice.effort && choice.modelId) {
          void save({ ...choice, effort: effort as Effort });
        }
      }}
    >
      <ModelSelectorTrigger
        aria-label={t("pickerLabel", { task: name })}
        disabled={saving}
        className="h-9 w-full justify-between md:w-85"
      >
        <ModelSelectorValue placeholder={t("choose")} showEffort={false} />
        {selected?.efforts && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
            <BrainIcon className="size-3" aria-hidden="true" />
            {t(`effort.${choice.effort}`)}
          </span>
        )}
      </ModelSelectorTrigger>
      <ModelSelectorContent className="w-80 sm:w-96" align="end">
        <ModelSelectorSearch aria-label={t("searchLabel")} placeholder={t("search")} />
        <ModelSelectorList>
          <ModelSelectorEmpty>{t("noMatch")}</ModelSelectorEmpty>
          {groups.map((group) => (
            <ModelSelectorGroup key={group.provider.id} heading={group.provider.name}>
              {group.options.map((option) => (
                <ModelSelectorItem key={option.id} model={option} />
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
        <ModelSelectorEffort label={t("reasoning")} />
      </ModelSelectorContent>
    </ModelSelectorRoot>
  );
}

export { TaskModel };
