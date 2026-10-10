import { PlugZapIcon, ScanSearchIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { HelpPopover } from "@/components/composites/help-popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AiProviders } from "@/lib/api/generated";
import { SettingsBlock } from "@/features/ai/settings-block";
import { siteRoutes } from "@/lib/site";

import { ChangeModel } from "./change-model";
import { DeleteProvider } from "./delete-provider";
import { ProviderEditor } from "./provider-editor";
import { ProviderLogo } from "./provider-logo";

/**
 * The Embedding tab of Admin › AI › Providers: the model search embeds with, the providers
 * connected, and the providers that can be. A key is never shown; a provider says only whether it
 * has one.
 */
async function EmbeddingTab({ data }: { data: AiProviders }) {
  const [t, format] = await Promise.all([getTranslations("Admin.ai"), getFormatter()]);
  const embedding = data.embedding ?? null;
  const vendorOf = (id: string) => data.vendors.find((vendor) => vendor.id === id);
  const usedBy = embedding?.total ?? 0;
  const activeVendor =
    data.providers.find((provider) => provider.id === embedding?.providerId)?.vendor ?? "openai";

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
          id="embedding-model"
          title={t("model.heading")}
          help={
            <HelpPopover label={t("model.headingHelp")}>
              <p>{t("model.headingLead")}</p>
            </HelpPopover>
          }
          first
        >
          {embedding ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <ProviderLogo vendor={activeVendor} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-all">{embedding.model}</span>
                    <Badge variant="success">{t("model.active")}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("model.through", { name: embedding.providerName })}
                  </span>
                </div>
                <ChangeModel
                  providers={data.providers}
                  vendors={data.vendors}
                  current={embedding}
                  items={embedding.total}
                  settingsVersion={data.settingsVersion}
                />
              </div>
              <dl className="grid grid-cols-3 divide-x">
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t("model.dimensions")}
                    <HelpPopover label={t("model.dimensionsHelp")}>
                      <p>{t("model.dimensionsAbout")}</p>
                    </HelpPopover>
                  </dt>
                  <dd className="text-sm font-medium">{format.number(embedding.dimensions)}</dd>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{t("model.embedded")}</dt>
                  <dd className="text-sm font-medium">
                    {t("model.embeddedOf", {
                      embedded: embedding.embedded,
                      total: embedding.total,
                    })}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{t("model.since")}</dt>
                  <dd className="text-sm font-medium">
                    {embedding.since
                      ? format.dateTime(new Date(embedding.since), {
                          dateStyle: "medium",
                          timeZone: "Asia/Ho_Chi_Minh",
                        })
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t bg-muted px-4 py-2.5 text-xs">
                <span className="font-medium text-muted-foreground">{t("model.usedBy")}</span>
                <ScanSearchIcon className="size-3.5" aria-hidden="true" />
                <span className="flex-1">{t("model.search", { count: usedBy })}</span>
                <Button prominence="tertiary" size="sm" href={siteRoutes.adminSearchIndex}>
                  {t("model.openIndex")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PlugZapIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>
                    {data.providers.length === 0
                      ? t("model.none.title")
                      : t("model.notChosen.title")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {data.providers.length === 0 ? t("model.none.lead") : t("model.notChosen.lead")}
                  </EmptyDescription>
                </EmptyHeader>
                {data.providers.length > 0 && (
                  <ChangeModel
                    providers={data.providers}
                    vendors={data.vendors}
                    current={null}
                    items={0}
                    settingsVersion={data.settingsVersion}
                  />
                )}
              </Empty>
            </div>
          )}
        </SettingsBlock>

        {data.providers.length > 0 && (
          <SettingsBlock id="connected" title={t("connected.heading")}>
            <ul className="overflow-hidden rounded-lg border">
              {data.providers.map((provider) => {
                const vendor = vendorOf(provider.vendor);
                return (
                  <li
                    key={provider.id}
                    className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <ProviderLogo vendor={provider.vendor} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        {provider.inUse && <Badge variant="success">{t("connected.inUse")}</Badge>}
                        <Badge variant="outline">
                          {provider.hasKey ? t("connected.keySaved") : t("connected.noKey")}
                        </Badge>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("connected.meta", {
                          address: provider.baseUrl,
                          name: provider.updatedBy,
                          date: format.dateTime(new Date(provider.updatedAt), {
                            day: "numeric",
                            month: "short",
                            timeZone: "Asia/Ho_Chi_Minh",
                          }),
                        })}
                      </span>
                      {provider.inUse && (
                        <span className="text-xs text-muted-foreground">
                          {t("connected.inUseNote")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {vendor && <ProviderEditor vendor={vendor} provider={provider} />}
                      <DeleteProvider provider={provider} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </SettingsBlock>
        )}

        <SettingsBlock id="add-provider" title={t("add.heading")}>
          <ul className="grid gap-2 md:grid-cols-2">
            {data.vendors.map((vendor) => (
              <li
                key={vendor.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
              >
                <ProviderLogo vendor={vendor.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`editor.vendor.${vendor.id}`)}</span>
                  {vendor.id === "openrouter" && (
                    <span className="text-xs text-muted-foreground">{t("add.openrouter")}</span>
                  )}
                </div>
                <ProviderEditor vendor={vendor} />
              </li>
            ))}
          </ul>
        </SettingsBlock>
      </div>
    </>
  );
}

export { EmbeddingTab };
