"use client";

import { TriangleAlertIcon } from "lucide-react";
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

import { aiError } from "./admin-ai-errors";
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
  const [providerId, setProviderId] = useState(current?.providerId ?? usable[0]?.id ?? "");
  const provider = usable.find((each) => each.id === providerId);
  const models = vendors.find((vendor) => vendor.id === provider?.vendor)?.models ?? [];
  const [model, setModel] = useState(current?.model ?? models[0] ?? "");
  const [result, setResult] = useState<AiProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const changing = current !== null && current.model !== model;

  function pickProvider(next: string) {
    setProviderId(next);
    const vendor = usable.find((each) => each.id === next)?.vendor;
    setModel(vendors.find((each) => each.id === vendor)?.models[0] ?? "");
    setResult(null);
  }

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
      notify.error(aiError(error));
    } finally {
      setTesting(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) {
      return;
    }
    setSaving(true);
    try {
      await chooseEmbeddingModel({
        body: { providerId: provider.id, model, version: settingsVersion },
      });
      notify.success("Admin.ai.done.modelChosen", { model });
      setSaving(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
      setSaving(false);
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
      <Dialog open={open} onOpenChange={(next) => (saving ? undefined : setOpen(next))}>
        <DialogContent className="sm:max-w-125">
          <form noValidate onSubmit={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-provider`}>{t("provider")}</FieldLabel>
                <NativeSelect
                  id={`${id}-provider`}
                  className="w-full"
                  value={providerId}
                  onChange={(event) => pickProvider(event.target.value)}
                >
                  {usable.map((each) => (
                    <NativeSelectOption key={each.id} value={each.id}>
                      {each.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-model`}>{t("model")}</FieldLabel>
                <NativeSelect
                  id={`${id}-model`}
                  className="w-full"
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setResult(null);
                  }}
                >
                  {models.map((each) => (
                    <NativeSelectOption key={each} value={each}>
                      {each}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>{t("dimensionsHint")}</FieldDescription>
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-2.5 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm font-medium">{t("test")}</p>
                  <p className="text-xs text-muted-foreground">{t("testHint")}</p>
                </div>
                <Button
                  prominence="secondary"
                  pending={testing}
                  disabled={!provider}
                  onClick={test}
                >
                  {t("testButton")}
                </Button>
              </div>
              {result && <ProbeResult result={result} />}
            </div>

            {changing && (
              <div className="flex items-start gap-2.5 rounded-lg border bg-muted p-3 text-sm">
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <p>
                  {t("warning", {
                    count: items,
                    minutes: Math.max(1, Math.ceil(items / PER_MINUTE)),
                  })}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button prominence="secondary" disabled={saving} onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={saving} disabled={!provider || model === ""}>
                {changing ? t("embedAgain") : t("use")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ChangeModel };
