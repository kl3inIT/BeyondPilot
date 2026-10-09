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
  addChatModels,
  changeChatProvider,
  connectChatProvider,
  testChatProvider,
  type ChatProvider,
  type ChatProviderTest,
  type ProbeChatProvider,
  type SaveChatProvider,
} from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import type { ChatPreset } from "./chat-presets";
import { ModelsField, useReportedModels } from "./models-field";

/**
 * What a test of a connection found: how many models and how long when it worked, a fixed reason
 * when it did not. The provider's own message is never shown.
 */
function ProviderTestResult({
  result,
  className,
}: {
  result: ChatProviderTest;
  className?: string;
}) {
  const t = useTranslations("Admin.ai.chat.connections");

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
            ? t("testOk", { ms: result.latencyMs, count: result.modelCount ?? 0 })
            : t("testFailed", { ms: result.latencyMs })}
        </p>
        {!result.ok && result.reason && (
          <p className="text-muted-foreground">{t(`reason.${result.reason}`)}</p>
        )}
      </div>
    </div>
  );
}

type ProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What to connect; ignored when a provider is given. */
  preset: Pick<ChatPreset, "name" | "adapterType" | "baseUrl">;
  /** The provider to change; none to connect a new one. */
  provider?: ChatProvider;
};

/**
 * Connects a chat provider, or changes one. The address is free: a gateway often sits on a private
 * one. The key field is never filled in: a saved key is kept, replaced or removed, and it is kept
 * only while the address stays the same. A new provider can list its models here and take the
 * ticked ones with it.
 */
function ProviderDialog({ open, onOpenChange, preset, provider }: ProviderDialogProps) {
  const t = useTranslations("Admin.ai.chat.editor");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const editing = provider !== undefined;
  const adapterType = provider?.adapterType ?? preset.adapterType;
  const [name, setName] = useState(provider?.name ?? preset.name);
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? preset.baseUrl);
  const [keyAction, setKeyAction] = useState<SaveChatProvider["key"]>(
    provider?.hasKey ? "keep" : "replace",
  );
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [result, setResult] = useState<ChatProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const reported = useReportedModels();

  const address = baseUrl.trim();
  const typedKey = keyAction === "replace" ? apiKey.trim() : "";
  const keyMissing = keyAction === "replace" && typedKey === "";
  // A saved key is only used with the address it was saved for, so a new address needs the key again.
  const keyMoved = editing && keyAction === "keep" && address !== provider.baseUrl;
  const usableKey = typedKey !== "" || (keyAction === "keep" && !keyMoved);
  const probe: ProbeChatProvider | null =
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
      reported.reset();
    }
  }

  /** What was read with the old address or key says nothing about the new one. */
  function connectionChanged() {
    setResult(null);
    reported.reset();
  }

  async function test() {
    if (!probe) {
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testChatProvider({ body: probe });
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
    const body: SaveChatProvider = {
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
        await changeChatProvider({ path: { id: provider.id }, body });
      } else {
        const { data } = await connectChatProvider({ body });
        const models = reported.chosen();
        const created = data.providers.find((each) => each.name === body.name);
        if (created && models.length > 0) {
          await addChatModels({ path: { id: created.id }, body: { models } });
        }
      }
      notify.success(editing ? "Admin.ai.chat.done.saved" : "Admin.ai.chat.done.connected", {
        name: body.name,
      });
      setSaving(false);
      change(false);
    } catch (error) {
      notify.error(chatError(error));
      setSaving(false);
    }
    // The provider may be saved even when its models were refused, so the page is read again either way.
    router.refresh();
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
                placeholder={
                  adapterType === "anthropic" ? "https://api.anthropic.com" : "https://…/v1"
                }
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  connectionChanged();
                }}
              />
              <FieldDescription>
                {t(`endpointHint.${adapterType === "anthropic" ? "anthropic" : "openai"}`)}
              </FieldDescription>
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
                    setKeyAction(event.target.value as SaveChatProvider["key"]);
                    connectionChanged();
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
                    connectionChanged();
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

          {!editing && <ModelsField reported={reported} probe={probe} />}

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
            {result && <ProviderTestResult result={result} className="rounded-lg" />}
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

export { ProviderDialog, ProviderTestResult };
