"use client";

import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [modelName, setModelName] = useState(model?.modelName ?? "");
  const [displayName, setDisplayName] = useState(model?.displayName ?? "");
  const [contextWindow, setContextWindow] = useState(String(model?.contextWindow ?? 32000));
  const [maxOutput, setMaxOutput] = useState(String(model?.maxOutputTokens ?? ""));
  const [inputPrice, setInputPrice] = useState(String(model?.inputPrice ?? ""));
  const [outputPrice, setOutputPrice] = useState(String(model?.outputPrice ?? ""));
  const [cachedPrice, setCachedPrice] = useState(String(model?.cachedInputPrice ?? ""));
  const [toolCalling, setToolCalling] = useState(model?.toolCalling ?? true);
  const [vision, setVision] = useState(model?.vision ?? false);
  const [reasoning, setReasoning] = useState(model?.reasoning ?? false);
  const [result, setResult] = useState<ChatModelTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const context = numberOf(contextWindow);
  const output = numberOf(maxOutput);
  const outputTooLarge = context !== null && output !== null && output >= context;
  const invalid = modelName.trim() === "" || context === null || context < 1 || outputTooLarge;

  function change(next: boolean) {
    if (saving) {
      return;
    }
    onOpenChange(next);
    if (!next) {
      setResult(null);
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

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || context === null) {
      return;
    }
    setSaving(true);
    const body: SaveChatModel = {
      modelName: modelName.trim(),
      displayName: displayName.trim() || null,
      contextWindow: context,
      maxOutputTokens: output,
      inputPrice: numberOf(inputPrice),
      outputPrice: numberOf(outputPrice),
      cachedInputPrice: numberOf(cachedPrice),
      toolCalling,
      vision,
      reasoning,
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
      setSaving(false);
      change(false);
      router.refresh();
    } catch (error) {
      notify.error(chatError(error));
      setSaving(false);
    }
  }

  const amount = (
    key: "inputPrice" | "outputPrice" | "cachedPrice",
    value: string,
    set: (next: string) => void,
  ) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{t(key)}</FieldLabel>
      <Input
        id={`${id}-${key}`}
        inputMode="decimal"
        aria-describedby={`${id}-prices-hint`}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </Field>
  );
  const capability = (
    key: "toolCalling" | "vision" | "reasoning",
    value: boolean,
    set: (next: boolean) => void,
  ) => (
    <Field orientation="horizontal">
      <Checkbox id={`${id}-${key}`} checked={value} onCheckedChange={set} />
      <FieldLabel htmlFor={`${id}-${key}`}>{t(key)}</FieldLabel>
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-140">
        <form noValidate onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("editTitle", { name: model.modelName })
                : t("addTitle", { name: provider.name })}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-model`}>{t("modelName")}</FieldLabel>
              <Input
                id={`${id}-model`}
                spellCheck={false}
                maxLength={200}
                required
                readOnly={editing}
                aria-describedby={editing ? undefined : `${id}-model-hint`}
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
              />
              {!editing && (
                <FieldDescription id={`${id}-model-hint`}>{t("modelNameHint")}</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-display`}>{t("displayName")}</FieldLabel>
              <Input
                id={`${id}-display`}
                maxLength={200}
                aria-describedby={`${id}-display-hint`}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <FieldDescription id={`${id}-display-hint`}>{t("displayNameHint")}</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-context`}>{t("contextWindow")}</FieldLabel>
                <Input
                  id={`${id}-context`}
                  inputMode="numeric"
                  required
                  value={contextWindow}
                  onChange={(event) => setContextWindow(event.target.value)}
                />
              </Field>
              <Field data-invalid={outputTooLarge || undefined}>
                <FieldLabel htmlFor={`${id}-output`}>{t("maxOutput")}</FieldLabel>
                <Input
                  id={`${id}-output`}
                  inputMode="numeric"
                  aria-invalid={outputTooLarge || undefined}
                  aria-describedby={`${id}-output-hint`}
                  value={maxOutput}
                  onChange={(event) => setMaxOutput(event.target.value)}
                />
              </Field>
            </div>
            <FieldDescription id={`${id}-output-hint`}>{t("maxOutputHint")}</FieldDescription>
            <div className="grid gap-4 sm:grid-cols-3">
              {amount("inputPrice", inputPrice, setInputPrice)}
              {amount("outputPrice", outputPrice, setOutputPrice)}
              {amount("cachedPrice", cachedPrice, setCachedPrice)}
            </div>
            <FieldDescription id={`${id}-prices-hint`}>
              {model && !model.priceFromCatalog ? t("pricesOwn") : t("pricesFromCatalog")}
            </FieldDescription>
            <FieldSet>
              <FieldLegend variant="label">{t("capabilities")}</FieldLegend>
              <div className="flex flex-col gap-2">
                {capability("toolCalling", toolCalling, setToolCalling)}
                {capability("vision", vision, setVision)}
                {capability("reasoning", reasoning, setReasoning)}
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
