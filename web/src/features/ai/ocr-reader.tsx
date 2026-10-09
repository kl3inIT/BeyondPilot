"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotify } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import {
  setDocumentReader,
  type ChatProvider,
  type DocumentReader,
  type OcrProvider,
  type SetDocumentReader,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { chatError } from "./chat-errors";
import { ModelPicker, type ModelChoice } from "./model-picker";

type Kind = "model" | "ocr";

/**
 * What reads a page that is only a picture: a chat model that reads images, or a connected OCR
 * service. Switching between the two saves nothing; choosing a model or a service does, at once.
 */
function OcrReader({
  reader,
  services,
  providers,
}: {
  reader: DocumentReader;
  services: OcrProvider[];
  providers: ChatProvider[];
}) {
  const t = useTranslations("Admin.ai.ocr.reader");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState<Kind>(reader.ocrProviderId ? "ocr" : "model");
  const [model, setModel] = useState<ModelChoice>({
    modelId: reader.modelId ?? "",
    effort: reader.reasoningEffort,
  });
  const [service, setService] = useState(reader.ocrProviderId ?? "");
  const [saving, setSaving] = useState(false);
  const usable = services.filter((each) => each.enabled && each.hasKey);
  const readsImages = providers.some(
    (provider) =>
      provider.enabled && provider.hasKey && provider.models.some((each) => each.vision),
  );

  async function save(
    body: Omit<SetDocumentReader, "version">,
    undo: () => void,
    done: () => void,
  ) {
    setSaving(true);
    try {
      await setDocumentReader({ body: { ...body, version: reader.version } });
      done();
    } catch (error) {
      undo();
      notify.error(chatError(error));
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  function chooseModel(next: ModelChoice, modelName: string | undefined) {
    const before = model;
    setModel(next);
    void save(
      { modelId: next.modelId || null, reasoningEffort: next.effort, ocrProviderId: null },
      () => setModel(before),
      () => {
        setService("");
        if (modelName) {
          notify.success("Admin.ai.ocr.done.readerSet", { name: modelName });
        }
      },
    );
  }

  function chooseService(next: string) {
    const before = service;
    setService(next);
    void save(
      { modelId: null, ocrProviderId: next || null },
      () => setService(before),
      () => {
        setModel({ ...model, modelId: "" });
        const name = usable.find((each) => each.id === next)?.name;
        if (name) {
          notify.success("Admin.ai.ocr.done.readerSet", { name });
        }
      },
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-85">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={t("kindLabel")}
        className="w-full"
        value={[kind]}
        onValueChange={(values) => {
          const next = values.at(-1);
          if (next === "model" || next === "ocr") {
            setKind(next);
          }
        }}
      >
        <ToggleGroupItem value="model" className="flex-1">
          {t("kind.model")}
        </ToggleGroupItem>
        <ToggleGroupItem value="ocr" className="flex-1">
          {t("kind.ocr")}
        </ToggleGroupItem>
      </ToggleGroup>
      {kind === "model" ? (
        <>
          <ModelPicker
            label={t("modelLabel")}
            providers={providers}
            visionOnly
            value={model}
            disabled={saving || !readsImages}
            onChange={chooseModel}
          />
          <p className="text-xs text-muted-foreground">
            {t.rich(readsImages ? "modelsFrom" : "noModels", {
              chat: (chunks) => (
                <Link
                  href={siteRoutes.adminAiProviders}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </>
      ) : (
        <>
          <NativeSelect
            id={`${id}-service`}
            aria-label={t("serviceLabel")}
            className="w-full"
            value={service}
            disabled={saving || usable.length === 0}
            onChange={(event) => chooseService(event.target.value)}
          >
            <NativeSelectOption value="">{t("chooseService")}</NativeSelectOption>
            {usable.map((each) => (
              <NativeSelectOption key={each.id} value={each.id}>
                {each.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {usable.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("noServices")}</p>
          )}
        </>
      )}
    </div>
  );
}

export { OcrReader };
