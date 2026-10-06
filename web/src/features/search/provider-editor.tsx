"use client";

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
import { useNotify } from "@/hooks/use-notify";
import {
  createAiProvider,
  testAiProvider,
  updateAiProvider,
  type AiProvider,
  type AiProviderTest,
  type AiVendor,
  type SaveAiProvider,
} from "@/lib/api/generated";

import { aiError } from "./admin-ai-errors";
import { ProbeResult } from "./provider-probe";

type ProviderEditorProps = {
  vendor: AiVendor;
  /** The provider to change; none to connect a new one of the vendor. */
  provider?: AiProvider;
};

/**
 * Connects a provider, or changes one, in a dialog. The address is the vendor's own and cannot be
 * changed. The key field is never filled in: a saved key is kept, replaced or removed, and a test
 * embeds one sentence with the key and model as the form holds them before anything is saved.
 */
function ProviderEditor({ vendor, provider }: ProviderEditorProps) {
  const t = useTranslations("Admin.ai.editor");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const editing = provider !== undefined;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(provider?.name ?? t(`vendor.${vendor.id}`));
  const [keyAction, setKeyAction] = useState<SaveAiProvider["key"]>(editing ? "keep" : "replace");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(vendor.models[0] ?? "");
  const [result, setResult] = useState<AiProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Closing forgets the key typed, so it lives no longer than the dialog. */
  function change(next: boolean) {
    if (saving) {
      return;
    }
    setOpen(next);
    if (!next) {
      setApiKey("");
      setResult(null);
      setKeyAction(editing ? "keep" : "replace");
    }
  }

  const typedKey = keyAction === "replace" ? apiKey.trim() : "";
  const keyMissing = keyAction === "replace" && typedKey === "";

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testAiProvider({
        body: {
          providerId: provider?.id ?? null,
          vendor: vendor.id,
          baseUrl: vendor.baseUrl,
          apiKey: typedKey || null,
          model,
        },
      });
      setResult(data);
    } catch (error) {
      notify.error(aiError(error));
    } finally {
      setTesting(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (keyMissing) {
      return;
    }
    setSaving(true);
    const body: SaveAiProvider = {
      vendor: vendor.id,
      name: name.trim(),
      baseUrl: vendor.baseUrl,
      key: keyAction,
      apiKey: typedKey || null,
      version: provider?.version ?? 0,
    };
    try {
      if (provider) {
        await updateAiProvider({ path: { id: provider.id }, body });
      } else {
        await createAiProvider({ body });
      }
      notify.success(editing ? "Admin.ai.done.saved" : "Admin.ai.done.connected", {
        name: body.name,
      });
      setSaving(false);
      change(false);
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
      setSaving(false);
    }
  }

  return (
    <>
      {editing ? (
        <Button prominence="tertiary" size="sm" onClick={() => setOpen(true)}>
          {t("edit")}
        </Button>
      ) : (
        <Button
          prominence="secondary"
          size="sm"
          aria-label={t("connectLabel", { name: t(`vendor.${vendor.id}`) })}
          onClick={() => setOpen(true)}
        >
          {t("connect")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={change}>
        <DialogContent className="sm:max-w-120">
          <form noValidate onSubmit={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? t("editTitle", { name: provider.name })
                  : t("connectTitle", { name: t(`vendor.${vendor.id}`) })}
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
                <FieldLabel htmlFor={`${id}-address`}>{t("address")}</FieldLabel>
                <Input id={`${id}-address`} value={vendor.baseUrl} readOnly />
                <FieldDescription>{t("addressHint")}</FieldDescription>
              </Field>
              <Field data-invalid={keyMissing && apiKey !== "" ? true : undefined}>
                <FieldLabel htmlFor={editing ? `${id}-key-action` : `${id}-key`}>
                  {t("apiKey")}
                </FieldLabel>
                {editing && (
                  <NativeSelect
                    id={`${id}-key-action`}
                    className="w-full"
                    value={keyAction}
                    onChange={(event) => setKeyAction(event.target.value as SaveAiProvider["key"])}
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
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                )}
                <FieldDescription>{t(`keyHint.${vendor.id}`)}</FieldDescription>
              </Field>
            </FieldGroup>

            <section
              aria-labelledby={`${id}-test`}
              className="flex flex-col gap-2.5 rounded-lg border p-3"
            >
              <h3 id={`${id}-test`} className="text-sm font-medium">
                {t("test")}
              </h3>
              <div className="flex items-center gap-2">
                <NativeSelect
                  aria-label={t("model")}
                  className="w-full"
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setResult(null);
                  }}
                >
                  {vendor.models.map((each) => (
                    <NativeSelectOption key={each} value={each}>
                      {each}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button
                  prominence="secondary"
                  pending={testing}
                  disabled={keyMissing || keyAction === "remove"}
                  onClick={test}
                >
                  {t("testButton")}
                </Button>
              </div>
              {result ? (
                <ProbeResult result={result} />
              ) : (
                <p className="text-xs text-muted-foreground">{t("testHint")}</p>
              )}
            </section>

            <DialogFooter>
              <Button prominence="secondary" disabled={saving} onClick={() => change(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={saving} disabled={keyMissing || name.trim() === ""}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ProviderEditor };
