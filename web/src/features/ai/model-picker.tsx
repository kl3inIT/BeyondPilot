"use client";

import { BrainIcon } from "lucide-react";
import { useTranslations } from "next-intl";

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
import type { ChatProvider, ChatTask } from "@/lib/api/generated";

import { ModelLogo } from "./model-logo";

const levels = ["off", "low", "medium", "high"] as const;

type Effort = ChatTask["reasoningEffort"];

type ModelChoice = { modelId: string; effort: Effort };

/**
 * A model chosen among the chat providers', on assistant-ui's Model selector: search, one group per
 * provider, and for a model that reasons the level it reasons at. Only a model whose provider is
 * switched on and has a key can be chosen. The owner saves what is picked.
 */
function ModelPicker({
  label,
  providers,
  visionOnly = false,
  value,
  disabled,
  onChange,
}: {
  label: string;
  providers: ChatProvider[];
  /** Whether only a model that reads images can be chosen. */
  visionOnly?: boolean;
  value: ModelChoice;
  disabled: boolean;
  /** Called with the new choice and the name of its model. */
  onChange: (next: ModelChoice, modelName: string | undefined) => void;
}) {
  const t = useTranslations("Admin.ai.chat.tasks");
  const efforts = levels.map((level) => ({ id: level, name: t(`effort.${level}`) }));
  const groups = providers
    .filter((provider) => provider.enabled && provider.hasKey)
    .map((provider) => ({
      provider,
      models: provider.models.filter((model) => !visionOnly || model.vision),
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
  const selected = options.find((option) => option.id === value.modelId);
  const nameOf = (modelId: string) => options.find((option) => option.id === modelId)?.name;

  return (
    <ModelSelectorRoot
      models={options}
      value={value.modelId}
      onValueChange={(modelId) => {
        if (modelId !== value.modelId) {
          onChange({ ...value, modelId }, nameOf(modelId));
        }
      }}
      effort={value.effort}
      onEffortChange={(effort) => {
        if (effort !== value.effort && value.modelId) {
          onChange({ ...value, effort: effort as Effort }, nameOf(value.modelId));
        }
      }}
    >
      <ModelSelectorTrigger
        aria-label={label}
        disabled={disabled}
        className="h-9 w-full justify-between md:w-85"
      >
        <ModelSelectorValue placeholder={t("choose")} showEffort={false} />
        {selected?.efforts && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
            <BrainIcon className="size-3" aria-hidden="true" />
            {t(`effort.${value.effort}`)}
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

export { ModelPicker, type ModelChoice };
