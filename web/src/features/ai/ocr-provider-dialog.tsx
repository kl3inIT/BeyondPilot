"use client";

import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [name, setName] = useState<string>(provider?.name ?? preset.name);
  const [baseUrl, setBaseUrl] = useState<string>(provider?.baseUrl ?? preset.baseUrl);
  const [keyAction, setKeyAction] = useState<SaveOcrProvider["key"]>(
    provider?.hasKey ? "keep" : "replace",
  );
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [result, setResult] = useState<OcrProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const address = baseUrl.trim();
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

  /** Closing forgets the key typed, so it lives no longer than the dialog. */
  function change(next: boolean) {
    if (saving) {
      return;
    }
    onOpenChange(next);
    if (!next) {
      setApiKey("");
      setResult(null);
    }
  }

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

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const body: SaveOcrProvider = {
      adapterType,
      name: name.trim(),
      baseUrl: address,
      enabled,
      key: keyAction,
      apiKey: typedKey || null,
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
      setSaving(false);
      change(false);
      router.refresh();
    } catch (error) {
      notify.error(chatError(error));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-140">
        <form noValidate onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("editTitle", { name: provider.name })
                : t("connectTitle", { name: preset.name })}
            </DialogTitle>
            <DialogDescription>{editing ? t("editLead") : t("connectLead")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
              <Input
                id={`${id}-name`}
                maxLength={60}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-endpoint`}>{t("endpoint")}</FieldLabel>
              <Input
                id={`${id}-endpoint`}
                type="url"
                inputMode="url"
                spellCheck={false}
                maxLength={2048}
                required
                placeholder={preset.baseUrl}
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setResult(null);
                }}
              />
              <FieldDescription>{t("endpointHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={editing ? `${id}-key-action` : `${id}-key`}>
                {t("apiKey")}
              </FieldLabel>
              {editing && (
                <NativeSelect
                  id={`${id}-key-action`}
                  className="w-full"
                  value={keyAction}
                  onChange={(event) => {
                    setKeyAction(event.target.value as SaveOcrProvider["key"]);
                    setResult(null);
                  }}
                >
                  <NativeSelectOption value="keep" disabled={!provider.hasKey}>
                    {t("keyKeep")}
                  </NativeSelectOption>
                  <NativeSelectOption value="replace">{t("keyReplace")}</NativeSelectOption>
                  <NativeSelectOption value="remove">{t("keyRemove")}</NativeSelectOption>
                </NativeSelect>
              )}
              {keyAction === "replace" && (
                <Input
                  id={`${id}-key`}
                  aria-label={editing ? t("newKey") : undefined}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={500}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setResult(null);
                  }}
                />
              )}
              <FieldDescription>{keyMoved ? t("keyMoved") : t("keyHint")}</FieldDescription>
            </Field>
            {editing && (
              <Field orientation="horizontal">
                <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`${id}-enabled`}>{t("enabled")}</FieldLabel>
                  <FieldDescription>{t("enabledHint")}</FieldDescription>
                </div>
              </Field>
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

          <DialogFooter>
            <Button prominence="secondary" disabled={saving} onClick={() => change(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              pending={saving}
              disabled={keyMissing || keyMoved || name.trim() === "" || address === ""}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { OcrProviderDialog, OcrTestResult };
