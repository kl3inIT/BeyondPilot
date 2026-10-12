"use client";

import { useStore } from "@tanstack/react-form";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { useAppForm } from "@/components/form/app-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import {
  addChatModels,
  changeChatModel,
  testChatModel,
  type ChatModel,
  type ChatModelTest,
  type ChatProvider,
  type SaveChatModel,
} from "@/lib/api/generated";

import { chatError } from "./chat-errors";

/** A number typed into a field: null when left empty or not a number. */
function numberOf(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
}

type ModelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ChatProvider;
  /** The model to correct; none to add one the provider does not list. */
  model?: ChatModel;
};

/**
 * Adds a model by name, or corrects one: its limits, what it can do and its prices in US dollars
 * per million tokens. A saved model can be asked one line to prove it answers.
 */
function ModelDialog({ open, onOpenChange, provider, model }: ModelDialogProps) {
  const t = useTranslations("Admin.ai.chat.model");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const editing = model !== undefined;
  const [result, setResult] = useState<ChatModelTest | null>(null);
  const [testing, setTesting] = useState(false);

  const form = useAppForm({
    defaultValues: {
      modelName: model?.modelName ?? "",
      displayName: model?.displayName ?? "",
      contextWindow: String(model?.contextWindow ?? 32000),
      maxOutput: String(model?.maxOutputTokens ?? ""),
      inputPrice: String(model?.inputPrice ?? ""),
      outputPrice: String(model?.outputPrice ?? ""),
      cachedPrice: String(model?.cachedInputPrice ?? ""),
      toolCalling: model?.toolCalling ?? true,
      vision: model?.vision ?? false,
      reasoning: model?.reasoning ?? false,
    },
    onSubmit: async ({ value }) => {
      const contextWindow = numberOf(value.contextWindow);
      if (invalid || contextWindow === null) {
        return;
      }
      const body: SaveChatModel = {
        modelName: value.modelName.trim(),
        displayName: value.displayName.trim() || null,
        contextWindow,
        maxOutputTokens: numberOf(value.maxOutput),
        inputPrice: numberOf(value.inputPrice),
        outputPrice: numberOf(value.outputPrice),
        cachedInputPrice: numberOf(value.cachedPrice),
        toolCalling: value.toolCalling,
        vision: value.vision,
        reasoning: value.reasoning,
        version: model?.version ?? 0,
      };
      try {
        if (model) {
          await changeChatModel({ path: { id: model.id }, body });
          notify.success("Admin.ai.chat.done.modelSaved", { name: body.modelName });
        } else {
          await addChatModels({ path: { id: provider.id }, body: { models: [body] } });
          notify.success("Admin.ai.chat.done.modelsAdded", { count: 1 });
        }
        close();
        router.refresh();
      } catch (error) {
        notify.error(chatError(error));
      }
    },
  });
  const { modelName, contextWindow, maxOutput } = useStore(form.store, (state) => state.values);
  const saving = useStore(form.store, (state) => state.isSubmitting);

  const context = numberOf(contextWindow);
  const output = numberOf(maxOutput);
  const outputTooLarge = context !== null && output !== null && output >= context;
  const invalid = modelName.trim() === "" || context === null || context < 1 || outputTooLarge;

  function close() {
    onOpenChange(false);
    form.reset();
    setResult(null);
  }

  function change(next: boolean) {
    if (saving) {
      return;
    }
    if (next) {
      onOpenChange(true);
    } else {
      close();
    }
  }

  async function test() {
    if (!model) {
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testChatModel({ path: { id: model.id } });
      setResult(data);
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-140">
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
                ? t("editTitle", { name: model.modelName })
                : t("addTitle", { name: provider.name })}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <form.AppField name="modelName">
              {(field) => (
                <field.TextField
                  label={t("modelName")}
                  spellCheck={false}
                  maxLength={200}
                  uncounted
                  required
                  readOnly={editing}
                  description={editing ? undefined : t("modelNameHint")}
                />
              )}
            </form.AppField>
            <form.AppField name="displayName">
              {(field) => (
                <field.TextField
                  label={t("displayName")}
                  maxLength={200}
                  description={t("displayNameHint")}
                />
              )}
            </form.AppField>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="contextWindow">
                {(field) => (
                  <field.TextField label={t("contextWindow")} inputMode="numeric" required />
                )}
              </form.AppField>
              {/* Marked as soon as it reaches the context window, whichever of the two was typed. */}
              <form.Field name="maxOutput">
                {(field) => (
                  <Field data-invalid={outputTooLarge || undefined}>
                    <FieldLabel htmlFor={`${id}-output`}>{t("maxOutput")}</FieldLabel>
                    <Input
                      id={`${id}-output`}
                      inputMode="numeric"
                      aria-invalid={outputTooLarge || undefined}
                      aria-describedby={`${id}-output-hint`}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
            <FieldDescription id={`${id}-output-hint`}>{t("maxOutputHint")}</FieldDescription>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["inputPrice", "outputPrice", "cachedPrice"] as const).map((key) => (
                <form.AppField key={key} name={key}>
                  {(field) => (
                    <field.TextField
                      label={t(key)}
                      inputMode="decimal"
                      aria-describedby={`${id}-prices-hint`}
                    />
                  )}
                </form.AppField>
              ))}
            </div>
            <FieldDescription id={`${id}-prices-hint`}>
              {model && !model.priceFromCatalog ? t("pricesOwn") : t("pricesFromCatalog")}
            </FieldDescription>
            <FieldSet>
              <FieldLegend variant="label">{t("capabilities")}</FieldLegend>
              <div className="flex flex-col gap-2">
                {(["toolCalling", "vision", "reasoning"] as const).map((key) => (
                  <form.AppField key={key} name={key}>
                    {(field) => <field.CheckboxField label={t(key)} />}
                  </form.AppField>
                ))}
              </div>
            </FieldSet>
          </FieldGroup>

          {editing && (
            <section aria-labelledby={`${id}-test`} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3 id={`${id}-test`} className="text-sm font-medium">
                    {t("test")}
                  </h3>
                  <p className="text-xs text-muted-foreground">{t("testHint")}</p>
                </div>
                <Button prominence="secondary" size="sm" pending={testing} onClick={test}>
                  {t("testButton")}
                </Button>
              </div>
              {result && (
                <p
                  role="status"
                  className="flex items-center gap-2.5 rounded-lg bg-muted p-2.5 text-sm font-medium"
                >
                  {result.ok ? (
                    <CircleCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <CircleXIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  {t(result.ok ? "testOk" : "testFailed", { ms: result.latencyMs })}
                </p>
              )}
            </section>
          )}

          <DialogFooter>
            <Button prominence="secondary" disabled={saving} onClick={() => change(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" pending={saving} disabled={invalid}>
              {editing ? t("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ModelDialog };
