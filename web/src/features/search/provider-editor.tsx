"use client";

import { useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { useAppForm } from "@/components/form/app-form";
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
  // The model the test embeds with is not saved, so it is no field of the form.
  const [model, setModel] = useState(vendor.models[0] ?? "");
  const [result, setResult] = useState<AiProviderTest | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: provider?.name ?? t(`vendor.${vendor.id}`),
      keyAction: (editing ? "keep" : "replace") as SaveAiProvider["key"],
      apiKey: "",
    },
    onSubmit: async ({ value }) => {
      const key = value.keyAction === "replace" ? value.apiKey.trim() : "";
      if (value.keyAction === "replace" && key === "") {
        return;
      }
      const body: SaveAiProvider = {
        vendor: vendor.id,
        name: value.name.trim(),
        baseUrl: vendor.baseUrl,
        key: value.keyAction,
        apiKey: key || null,
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
        close();
        router.refresh();
      } catch (error) {
        notify.error(aiError(error));
      }
    },
  });
  const { name, keyAction, apiKey } = useStore(form.store, (state) => state.values);
  const saving = useStore(form.store, (state) => state.isSubmitting);

  /** Closing forgets what was typed, so the key lives no longer than the dialog. */
  function close() {
    setOpen(false);
    form.reset();
    setResult(null);
  }

  function change(next: boolean) {
    if (saving) {
      return;
    }
    if (next) {
      setOpen(true);
    } else {
      close();
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
          <form
            id={form.formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? t("editTitle", { name: provider.name })
                  : t("connectTitle", { name: t(`vendor.${vendor.id}`) })}
              </DialogTitle>
              <DialogDescription>{editing ? t("editLead") : t("connectLead")}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <form.AppField name="name">
                {(field) => <field.TextField label={t("name")} maxLength={60} required />}
              </form.AppField>
              <Field>
                <FieldLabel htmlFor={`${id}-address`}>{t("address")}</FieldLabel>
                <Input
                  id={`${id}-address`}
                  value={vendor.baseUrl}
                  readOnly
                  aria-describedby={`${id}-address-hint`}
                />
                <FieldDescription id={`${id}-address-hint`}>{t("addressHint")}</FieldDescription>
              </Field>
              <Field data-invalid={keyMissing && apiKey !== "" ? true : undefined}>
                <FieldLabel htmlFor={editing ? `${id}-key-action` : `${id}-key`}>
                  {t("apiKey")}
                </FieldLabel>
                {editing && (
                  <form.Field name="keyAction">
                    {(field) => (
                      <NativeSelect
                        id={`${id}-key-action`}
                        className="w-full"
                        aria-describedby={`${id}-key-hint`}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value as SaveAiProvider["key"])
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
                  <form.Field name="apiKey">
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
                  {t(`keyHint.${vendor.id}`)}
                </FieldDescription>
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
