import { PlugZapIcon, ScanSearchIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/i18n/navigation";
import type { AiProviders } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { ChangeModel } from "./change-model";
import { DeleteProvider } from "./delete-provider";
import { ProviderEditor } from "./provider-editor";
import { ProviderLogo } from "./provider-logo";

/** One block of the page: what it is for on the left from 768px, its content on the right. */
function Block({
  id,
  title,
  lead,
  first,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 md:flex-row md:gap-12 ${first ? "" : "border-t pt-8"}`}
    >
      <div className="flex flex-col gap-1 md:w-65 md:shrink-0">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * Admin › AI › Providers: the AI services BeyondPilot calls, with a tab per purpose. Embedding is the
 * only one so far: the model search embeds with, the providers connected, and the providers that
 * can be. A key is never shown; a provider says only whether it has one.
 */
async function AiProvidersPage({ data }: { data: AiProviders }) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Admin.ai"),
    getFormatter(),
    getLocale(),
  ]);
  const embedding = data.embedding ?? null;
  const vendorOf = (id: string) => data.vendors.find((vendor) => vendor.id === id);
  const usedBy = embedding?.total ?? 0;
  const activeVendor =
    data.providers.find((provider) => provider.id === embedding?.providerId)?.vendor ?? "openai";

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("providers.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("providers.lead")}</p>
      </div>

      <nav aria-label={t("providers.tabs")} className="flex items-end gap-5 border-b">
        <Link
          href={siteRoutes.adminAiProviders}
          aria-current="page"
          className="-mb-px border-b-2 border-foreground px-0.5 py-2.5 text-sm font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("providers.embedding")}
        </Link>
      </nav>

      {!data.keysCanBeStored && (
        <Alert variant="destructive">
          <AlertTitle>{t("providers.noEncryption.title")}</AlertTitle>
          <AlertDescription>{t("providers.noEncryption.lead")}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-8">
        <Block id="embedding-model" title={t("model.heading")} lead={t("model.headingLead")} first>
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
                  <dt className="text-xs text-muted-foreground">{t("model.dimensions")}</dt>
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
        </Block>

        {data.providers.length > 0 && (
          <Block id="connected" title={t("connected.heading")} lead={t("connected.lead")}>
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
          </Block>
        )}

        <Block id="add-provider" title={t("add.heading")} lead={t("add.lead")}>
          <ul className="grid gap-2 md:grid-cols-2">
            {data.vendors.map((vendor) => (
              <li
                key={vendor.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
              >
                <ProviderLogo vendor={vendor.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`editor.vendor.${vendor.id}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`add.${vendor.id}`)}</span>
                </div>
                <ProviderEditor vendor={vendor} />
              </li>
            ))}
          </ul>
        </Block>
      </div>
    </div>
  );
}

export { AiProvidersPage };
