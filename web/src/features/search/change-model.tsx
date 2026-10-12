"use client";

import { useStore } from "@tanstack/react-form";
import { TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useNotify } from "@/hooks/use-notify";
import {
  chooseEmbeddingModel,
  testAiProvider,
  type AiProvider,
  type AiProviderTest,
  type AiVendor,
  type EmbeddingModelInUse,
} from "@/lib/api/generated";

import { ProbeResult } from "./provider-probe";

/** How many items the job embeds a minute: a batch of 32 every minute. */
const PER_MINUTE = 32;

type ChangeModelProps = {
  /** The connected providers; only those with a key can be chosen. */
  providers: AiProvider[];
  vendors: AiVendor[];
  current: EmbeddingModelInUse | null;
  /** How many items the index holds, all embedded again with a new model. */
  items: number;
  settingsVersion: number;
};

/**
 * Chooses the provider and model search embeds with. The backend embeds a test sentence before it
 * takes the choice; a new model embeds every item again, and until then an item is found by its
 * keywords. With no model yet, the same dialog sets the first one.
 */
function ChangeModel({ providers, vendors, current, items, settingsVersion }: ChangeModelProps) {
  const t = useTranslations("Admin.ai.model");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const usable = providers.filter((provider) => provider.hasKey);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AiProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  /** The models of the vendor a provider belongs to. */
  const modelsOf = (id: string) => {
    const vendor = usable.find((each) => each.id === id)?.vendor;
    return vendors.find((each) => each.id === vendor)?.models ?? [];
  };
  const firstProvider = current?.providerId ?? usable[0]?.id ?? "";

  const form = useAppForm({
    defaultValues: {
      providerId: firstProvider,
      model: current?.model ?? modelsOf(firstProvider)[0] ?? "",
    },
    onSubmit: async ({ value }) => {
      const chosen = usable.find((each) => each.id === value.providerId);
      if (!chosen) {
        return;
      }
      try {
        await chooseEmbeddingModel({
          body: { providerId: chosen.id, model: value.model, version: settingsVersion },
        });
        notify.success("Admin.ai.done.modelChosen", { model: value.model });
        setOpen(false);
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });
  const { providerId, model } = useStore(form.store, (state) => state.values);
  const provider = usable.find((each) => each.id === providerId);
  const models = modelsOf(providerId);
  const changing = current !== null && current.model !== model;

  async function test() {
    if (!provider) {
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testAiProvider({
        body: {
          providerId: provider.id,
          vendor: provider.vendor,
          baseUrl: provider.baseUrl,
          apiKey: null,
          model,
        },
      });
      setResult(data);
    } catch (error) {
      notify.failure(error);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <Button
        prominence={current ? "secondary" : "primary"}
        size="sm"
        disabled={usable.length === 0}
        onClick={() => setOpen(true)}
      >
        {current ? t("change") : t("choose")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            // The form starts again, and a test says nothing about the choice it starts with.
            setResult(null);
          }
        }}
        form={form}
        title={t("title")}
        description={t("lead")}
        width="lg"
        submitLabel={changing ? t("embedAgain") : t("use")}
        cancelLabel={t("cancel")}
        submitDisabled={!provider || model === ""}
      >
        <FieldGroup>
          <form.Field
            name="providerId"
            listeners={{
              // Another provider offers other models, so the choice starts at its first.
              onChange: ({ value }) => {
                form.setFieldValue("model", modelsOf(value)[0] ?? "");
                setResult(null);
              },
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`${id}-provider`}>{t("provider")}</FieldLabel>
                <NativeSelect
                  id={`${id}-provider`}
                  className="w-full"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {usable.map((each) => (
                    <NativeSelectOption key={each.id} value={each.id}>
                      {each.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
          <form.Field name="model" listeners={{ onChange: () => setResult(null) }}>
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`${id}-model`}>{t("model")}</FieldLabel>
                <NativeSelect
                  id={`${id}-model`}
                  className="w-full"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  {models.map((each) => (
                    <NativeSelectOption key={each} value={each}>
                      {each}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <div className="flex flex-col gap-2.5 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium">{t("test")}</p>
              <p className="text-xs text-muted-foreground">{t("testHint")}</p>
            </div>
            <Button prominence="secondary" pending={testing} disabled={!provider} onClick={test}>
              {t("testButton")}
            </Button>
          </div>
          {result && <ProbeResult result={result} />}
        </div>

        {changing && (
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted p-3 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>
              {t("warning", {
                count: items,
                minutes: Math.max(1, Math.ceil(items / PER_MINUTE)),
              })}
            </p>
          </div>
        )}
      </FormDialog>
    </>
  );
}

export { ChangeModel };
