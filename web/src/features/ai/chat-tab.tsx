import { PlugZapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ChatSettings } from "@/lib/api/generated";

import { ChatLogo } from "./chat-logo";
import { chatPresets, presetGroups } from "./chat-presets";
import { ConnectPreset } from "./connect-preset";
import { ConnectionCard } from "./connection-card";
import { SettingsBlock } from "./settings-block";
import { TaskModel } from "./task-model";

/**
 * The Chat tab of Admin › AI › Providers: the model each task uses, the providers connected with
 * the models enabled on each, and the providers that can be added. A key is never shown; a
 * provider says only whether it has one.
 */
async function ChatTab({ data }: { data: ChatSettings }) {
  const t = await getTranslations("Admin.ai");
  const usable = data.providers.some(
    (provider) => provider.enabled && provider.hasKey && provider.models.length > 0,
  );

  return (
    <>
      {!data.keysCanBeStored && (
        <Alert variant="destructive">
          <AlertTitle>{t("providers.noEncryption.title")}</AlertTitle>
          <AlertDescription>{t("providers.noEncryption.lead")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-8">
        <SettingsBlock
          id="task-models"
          title={t("chat.tasks.heading")}
          lead={t("chat.tasks.lead")}
          first
        >
          {usable ? (
            <ul className="overflow-hidden rounded-lg border bg-background">
              {data.tasks.map((task) => (
                <li
                  key={task.task}
                  className="flex flex-col gap-3 border-b p-4 last:border-b-0 md:flex-row md:items-center"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3 className="text-sm font-medium">{t(`chat.tasks.name.${task.task}`)}</h3>
                    {task.available ? (
                      <p className="text-sm text-muted-foreground">
                        {t(`chat.tasks.about.${task.task}`)}
                      </p>
                    ) : (
                      <p className="text-sm text-destructive">
                        {task.modelId ? t("chat.tasks.unavailable") : t("chat.tasks.unset")}
                      </p>
                    )}
                  </div>
                  {/* Keyed by its version, so the selector starts again from what was saved. */}
                  <TaskModel key={task.version} task={task} providers={data.providers} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PlugZapIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {data.providers.length === 0
                      ? t("chat.tasks.empty.title")
                      : t("chat.tasks.noModels.title")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {data.providers.length === 0
                      ? t("chat.tasks.empty.lead")
                      : t("chat.tasks.noModels.lead")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </SettingsBlock>

        {data.providers.length > 0 && (
          <SettingsBlock
            id="chat-connections"
            title={t("chat.connections.heading")}
            lead={t("chat.connections.lead")}
          >
            <ul className="flex flex-col gap-2">
              {data.providers.map((provider, index) => (
                <ConnectionCard
                  // A saved provider is read again in full, so its card starts again with it.
                  key={`${provider.id}:${provider.version}`}
                  provider={provider}
                  startOpen={provider.inUse || index === 0}
                />
              ))}
            </ul>
          </SettingsBlock>
        )}

        <SettingsBlock
          id="add-chat-provider"
          title={t("chat.add.heading")}
          lead={t("chat.add.lead")}
        >
          <div className="flex flex-col gap-4">
            {presetGroups.map((group) => (
              <div
                key={group}
                role="group"
                aria-labelledby={`chat-presets-${group}`}
                className="flex flex-col gap-2"
              >
                <h3
                  id={`chat-presets-${group}`}
                  className={
                    group === "vendors" ? "sr-only" : "text-xs font-medium text-muted-foreground"
                  }
                >
                  {t(`chat.add.group.${group}`)}
                </h3>
                <ul className="grid gap-2 md:grid-cols-2">
                  {chatPresets
                    .filter((preset) => preset.group === group)
                    .map((preset) => (
                      <li
                        key={preset.id}
                        className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
                      >
                        <ChatLogo preset={preset.id} />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm font-medium">{preset.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t(`chat.add.preset.${preset.id}`)}
                          </span>
                        </div>
                        <ConnectPreset preset={preset} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </SettingsBlock>
      </div>
    </>
  );
}

export { ChatTab };
