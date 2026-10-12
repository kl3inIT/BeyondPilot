"use client";

import { useStore } from "@tanstack/react-form";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import {
  changeOcrProvider,
  connectOcrProvider,
  testOcrProvider,
  type OcrProvider,
  type OcrProviderTest,
  type ProbeOcrProvider,
  type SaveOcrProvider,
} from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import type { OcrPreset } from "./ocr-presets";

/** The price typed: none when the field is empty. */
const priceOf = (text: string) => (text.trim() === "" ? null : Number(text));

/** A price is none or a number from 0 to 100,000; the field is marked, and has no words of its own. */
const priceSchema = z.string().refine((text) => {
  const price = priceOf(text);
  return price === null || (price >= 0 && price <= 100000);
}, "");

/**
 * What a test of an OCR connection found: that the service read the picture sent and how long it
 * took, or a fixed reason. The service's own message is never shown.
 */
function OcrTestResult({ result, className }: { result: OcrProviderTest; className?: string }) {
  const t = useTranslations("Admin.ai.ocr.connections");

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 bg-muted p-2.5 text-sm ${className ?? ""}`}
    >
      {result.ok ? (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium">
          {result.ok
            ? t("testOk", { ms: result.latencyMs })
            : t("testFailed", { ms: result.latencyMs })}
        </p>
        {!result.ok && result.reason && (
          <p className="text-muted-foreground">{t(`reason.${result.reason}`)}</p>
        )}
      </div>
    </div>
  );
}

type OcrProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What to connect; ignored when a provider is given. */
  preset: Pick<OcrPreset, "name" | "adapterType" | "baseUrl">;
  /** The provider to change; none to connect a new one. */
  provider?: OcrProvider;
};

/**
 * Connects an OCR service, or changes one. The key field is never filled in: a saved key is kept,
 * replaced or removed, and it is kept only while the address stays the same.
 */
function OcrProviderDialog({ open, onOpenChange, preset, provider }: OcrProviderDialogProps) {
  const t = useTranslations("Admin.ai.ocr.editor");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const editing = provider !== undefined;
  const adapterType = provider?.adapterType ?? preset.adapterType;
  const [result, setResult] = useState<OcrProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const savedName: string = provider?.name ?? preset.name;
  const savedAddress: string = provider?.baseUrl ?? preset.baseUrl;

  const form = useAppForm({
    defaultValues: {
      name: savedName,
      baseUrl: savedAddress,
      keyAction: (provider?.hasKey ? "keep" : "replace") as SaveOcrProvider["key"],
      apiKey: "",
      price: String(provider?.pricePerThousandCalls ?? ""),
      enabled: provider?.enabled ?? true,
    },
    onSubmit: async ({ value }) => {
      const body: SaveOcrProvider = {
        adapterType,
        name: value.name.trim(),
        baseUrl: value.baseUrl.trim(),
        enabled: value.enabled,
        key: value.keyAction,
        apiKey: (value.keyAction === "replace" && value.apiKey.trim()) || null,
        pricePerThousandCalls: priceOf(value.price),
        version: provider?.version ?? 0,
      };
      try {
        if (provider) {
          await changeOcrProvider({ path: { id: provider.id }, body });
        } else {
          await connectOcrProvider({ body });
        }
        notify.success(editing ? "Admin.ai.ocr.done.saved" : "Admin.ai.ocr.done.connected", {
          name: body.name,
        });
        change(false);
        router.refresh();
      } catch (error) {
        notify.error(chatError(error));
      }
    },
  });
  const { name, baseUrl, keyAction, apiKey, price } = useStore(form.store, (state) => state.values);

  const address = baseUrl.trim();
  const priceInvalid = !priceSchema.safeParse(price).success;
  const typedKey = keyAction === "replace" ? apiKey.trim() : "";
  const keyMissing = keyAction === "replace" && typedKey === "";
  // A saved key is only used with the address it was saved for, so a new address needs the key again.
  const keyMoved = editing && keyAction === "keep" && address !== provider.baseUrl;
  const usableKey = typedKey !== "" || (keyAction === "keep" && !keyMoved);
  const probe: ProbeOcrProvider | null =
    address !== "" && usableKey
      ? {
          providerId: provider?.id ?? null,
          adapterType,
          baseUrl: address,
          apiKey: typedKey || null,
        }
      : null;

  /** Closing forgets the test as the dialog forgets what was typed: the key lives no longer than it. */
  function change(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setResult(null);
    }
  }

  /** What was found with the old address or key says nothing about the new one. */
  const connectionChanged = () => setResult(null);

  async function test() {
    if (!probe) {
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testOcrProvider({ body: probe });
      setResult(data);
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={change}
      form={form}
      title={
        editing ? t("editTitle", { name: provider.name }) : t("connectTitle", { name: preset.name })
      }
      description={editing ? t("editLead") : t("connectLead")}
      width="xl"
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
      submitDisabled={
        keyMissing || keyMoved || priceInvalid || name.trim() === "" || address === ""
      }
    >
      <FieldGroup>
        <form.AppField name="name">
          {(field) => <field.TextField label={t("name")} maxLength={60} required />}
        </form.AppField>
        <form.AppField name="baseUrl" listeners={{ onChange: connectionChanged }}>
          {(field) => (
            <field.TextField
              label={t("endpoint")}
              type="url"
              inputMode="url"
              spellCheck={false}
              maxLength={2048}
              required
              description={t("endpointHint")}
            />
          )}
        </form.AppField>
        <Field>
          <FieldLabel htmlFor={editing ? `${id}-key-action` : `${id}-key`}>
            {t("apiKey")}
          </FieldLabel>
          {editing && (
            <form.Field name="keyAction" listeners={{ onChange: connectionChanged }}>
              {(field) => (
                <NativeSelect
                  id={`${id}-key-action`}
                  className="w-full"
                  aria-describedby={`${id}-key-hint`}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.value as SaveOcrProvider["key"])
                  }
                >
                  <NativeSelectOption value="keep" disabled={!provider.hasKey}>
                    {t("keyKeep")}
                  </NativeSelectOption>
                  <NativeSelectOption value="replace">{t("keyReplace")}</NativeSelectOption>
                  <NativeSelectOption value="remove">{t("keyRemove")}</NativeSelectOption>
                </NativeSelect>
              )}
            </form.Field>
          )}
          {keyAction === "replace" && (
            <form.Field name="apiKey" listeners={{ onChange: connectionChanged }}>
              {(field) => (
                <Input
                  id={`${id}-key`}
                  aria-label={editing ? t("newKey") : undefined}
                  aria-describedby={`${id}-key-hint`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={500}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              )}
            </form.Field>
          )}
          <FieldDescription id={`${id}-key-hint`}>
            {keyMoved ? t("keyMoved") : t("keyHint")}
          </FieldDescription>
        </Field>
        <form.AppField name="price" validators={{ onChange: priceSchema }}>
          {(field) => (
            <field.TextField
              label={t("price")}
              type="number"
              inputMode="decimal"
              min={0}
              max={100000}
              step="any"
              description={
                provider && !provider.priceFromCatalog && provider.pricePerThousandCalls != null
                  ? t("priceOwn")
                  : t("priceHint")
              }
            />
          )}
        </form.AppField>
        {editing && (
          <form.Field name="enabled">
            {(field) => (
              <Field orientation="horizontal">
                <Switch
                  id={`${id}-enabled`}
                  aria-describedby={`${id}-enabled-hint`}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`${id}-enabled`}>{t("enabled")}</FieldLabel>
                  <FieldDescription id={`${id}-enabled-hint`}>{t("enabledHint")}</FieldDescription>
                </div>
              </Field>
            )}
          </form.Field>
        )}
      </FieldGroup>

      <section aria-labelledby={`${id}-test`} className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 id={`${id}-test`} className="text-sm font-medium">
              {t("testTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("testHint")}</p>
          </div>
          <Button
            prominence="secondary"
            size="sm"
            pending={testing}
            disabled={probe === null}
            onClick={test}
          >
            {t("testTitle")}
          </Button>
        </div>
        {result && <OcrTestResult result={result} className="rounded-lg" />}
      </section>
    </FormDialog>
  );
}

export { OcrProviderDialog, OcrTestResult };
