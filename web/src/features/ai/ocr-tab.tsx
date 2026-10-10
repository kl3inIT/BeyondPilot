import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ChatSettings, OcrSettings } from "@/lib/api/generated";

import { ConnectOcrPreset, OcrConnectionCard, OcrLogo } from "./ocr-connection-card";
import { ocrPresets } from "./ocr-presets";
import { OcrReader } from "./ocr-reader";
import { SettingsBlock } from "./settings-block";

/**
 * The OCR tab of Admin › AI › Providers: what reads a page that is only a picture, the OCR services
 * connected, and the ones that can be added. The reader is a model of a chat provider or one of
 * the services. A key is never shown; a service says only whether it has one.
 */
async function OcrTab({ data, chat }: { data: OcrSettings; chat: ChatSettings }) {
  const t = await getTranslations("Admin.ai");
  const chosen = Boolean(data.reader.modelId || data.reader.ocrProviderId);

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
          id="document-reader"
          title={t("ocr.reader.heading")}
          lead={t("ocr.reader.lead")}
          first
        >
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 className="text-sm font-medium">{t("ocr.reader.name")}</h3>
              {data.reader.available ? (
                <p className="text-sm text-muted-foreground">{t("ocr.reader.about")}</p>
              ) : (
                <p className="text-sm text-destructive">
                  {chosen ? t("ocr.reader.unavailable") : t("ocr.reader.unset")}
                </p>
              )}
            </div>
            {/* Keyed by its version, so the choice starts again from what was saved. */}
            <OcrReader
              key={data.reader.version}
              reader={data.reader}
              services={data.providers}
              providers={chat.providers}
            />
          </div>
        </SettingsBlock>
        {data.providers.length > 0 && (
          <SettingsBlock id="ocr-connections" title={t("ocr.connections.heading")}>
            <ul className="flex flex-col gap-2">
              {data.providers.map((provider) => (
                // A saved provider is read again in full, so its card starts again with it.
                <OcrConnectionCard key={`${provider.id}:${provider.version}`} provider={provider} />
              ))}
            </ul>
          </SettingsBlock>
        )}
        <SettingsBlock id="add-ocr-provider" title={t("ocr.add.heading")}>
          <ul className="grid gap-2 md:grid-cols-2">
            {ocrPresets.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3"
              >
                <OcrLogo />
                <span className="min-w-0 flex-1 text-sm font-medium">{preset.name}</span>
                <ConnectOcrPreset preset={preset} />
              </li>
            ))}
          </ul>
        </SettingsBlock>
      </div>
    </>
  );
}

export { OcrTab };
