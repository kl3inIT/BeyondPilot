"use client";

import {
  BrainIcon,
  ChevronDownIcon,
  EllipsisIcon,
  EyeIcon,
  PlugZapIcon,
  Settings2Icon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNotify } from "@/hooks/use-notify";
import {
  addChatModels,
  removeChatModel,
  removeChatProvider,
  testChatProvider,
  type ChatModel,
  type ChatProvider,
  type ChatProviderTest,
  type ProbeChatProvider,
} from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import { ChatLogo } from "./chat-logo";
import { chatPresets, presetOf, price, tokens } from "./chat-presets";
import { ModelDialog } from "./model-dialog";
import { ModelLogo } from "./model-logo";
import { ModelsField, useReportedModels } from "./models-field";
import { ProviderDialog, ProviderTestResult } from "./provider-dialog";

const iconButton =
  "hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 data-popup-open:bg-muted [&>svg]:size-4";

/** Lists the models of a saved provider with its saved key, to enable more of them. */
function FetchModels({
  open,
  onOpenChange,
  provider,
  reported,
  probe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ChatProvider;
  reported: ReturnType<typeof useReportedModels>;
  probe: ProbeChatProvider;
}) {
  const t = useTranslations("Admin.ai.chat.fetch");
  const notify = useNotify();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const models = reported.chosen();

  async function add() {
    setSaving(true);
    try {
      await addChatModels({ path: { id: provider.id }, body: { models } });
      notify.success("Admin.ai.chat.done.modelsAdded", { count: models.length });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-140">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{provider.name}</DialogDescription>
        </DialogHeader>
        <ModelsField reported={reported} probe={probe} />
        <DialogFooter>
          <Button prominence="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button pending={saving} disabled={models.length === 0} onClick={add}>
            {t("add", { count: models.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One connected chat provider: where it is, whether it has a key and is switched on, and the models
 * enabled on it. It can be tested, changed and deleted; its models are fetched from the provider or
 * added by name, corrected and removed.
 */
function ConnectionCard({ provider, startOpen }: { provider: ChatProvider; startOpen: boolean }) {
  const t = useTranslations("Admin.ai.chat.connections");
  const tm = useTranslations("Admin.ai.chat.models");
  const td = useTranslations("Admin.ai.chat.delete");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const [expanded, setExpanded] = useState(startOpen);
  const [asking, setAsking] = useState<"edit" | "delete" | "fetch" | "add" | null>(null);
  const [editing, setEditing] = useState<ChatModel | null>(null);
  const [removing, setRemoving] = useState<ChatModel | null>(null);
  const [result, setResult] = useState<ChatProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [pending, setPending] = useState(false);
  const reported = useReportedModels();
  const preset = presetOf(provider);
  const probe: ProbeChatProvider = {
    providerId: provider.id,
    adapterType: provider.adapterType,
    baseUrl: provider.baseUrl,
    apiKey: null,
  };

  async function test() {
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

  async function act(call: () => Promise<unknown>, done: () => void) {
    setPending(true);
    try {
      await call();
      done();
      router.refresh();
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setPending(false);
      setAsking(null);
      setRemoving(null);
    }
  }

  function fetchModels() {
    setAsking("fetch");
    void reported.list(probe);
  }

  return (
    <li className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <ChatLogo preset={preset} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="text-sm font-medium">{provider.name}</h3>
            {provider.inUse && <Badge variant="success">{t("inUse")}</Badge>}
            {!provider.hasKey && <Badge variant="outline">{t("noKey")}</Badge>}
            {!provider.enabled && <Badge variant="outline">{t("off")}</Badge>}
          </div>
          <span className="truncate text-xs text-muted-foreground">{provider.baseUrl}</span>
        </div>
        <span className="hidden text-xs text-muted-foreground md:inline">
          {t("count", { count: provider.models.length })}
        </span>
        <div className="hidden items-center md:flex">
          <button
            type="button"
            className={iconButton}
            aria-label={t("test")}
            title={t("test")}
            disabled={testing || !provider.hasKey}
            onClick={test}
          >
            <PlugZapIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={t("edit")}
            title={t("edit")}
            onClick={() => setAsking("edit")}
          >
            <Settings2Icon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${iconButton} text-destructive`}
            aria-label={t("delete")}
            title={t("delete")}
            onClick={() => setAsking("delete")}
          >
            <Trash2Icon aria-hidden="true" />
          </button>
        </div>
        {/* On a phone the three actions fold into one menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={`${iconButton} md:hidden`}
                aria-label={t("more", { name: provider.name })}
              />
            }
          >
            <EllipsisIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={testing || !provider.hasKey} onClick={test}>
                <PlugZapIcon aria-hidden="true" />
                {t("test")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAsking("edit")}>
                <Settings2Icon aria-hidden="true" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setAsking("delete")}>
                <Trash2Icon aria-hidden="true" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className={iconButton}
          aria-label={t("toggle", { name: provider.name })}
          aria-expanded={expanded}
          aria-controls={`${id}-models`}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDownIcon className={expanded ? "rotate-180" : undefined} aria-hidden="true" />
        </button>
      </div>

      {result && <ProviderTestResult result={result} className="border-t px-4" />}

      {expanded && (
        <div id={`${id}-models`} className="flex flex-col gap-3 border-t p-4">
          {provider.models.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noModels")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableCaption className="sr-only">
                  {tm("caption", { name: provider.name })}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tm("model")}</TableHead>
                    <TableHead className="text-right">{tm("context")}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      {tm("maxOutput")}
                    </TableHead>
                    <TableHead className="hidden text-right md:table-cell">{tm("input")}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      {tm("output")}
                    </TableHead>
                    <TableHead className="w-20">
                      <span className="sr-only">{tm("actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provider.models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          <ModelLogo modelName={model.modelName} />
                          <span className="font-medium break-all">{model.displayName}</span>
                          <span className="hidden items-center gap-1.5 text-muted-foreground md:flex [&>svg]:size-3.5">
                            {model.toolCalling && (
                              <WrenchIcon role="img" aria-label={tm("tools")} />
                            )}
                            {model.vision && <EyeIcon role="img" aria-label={tm("vision")} />}
                            {model.reasoning && <BrainIcon role="img" aria-label={tm("reasons")} />}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{tokens(model.contextWindow)}</TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {model.maxOutputTokens ? tokens(model.maxOutputTokens) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {price(model.inputPrice)}
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {price(model.outputPrice)}
                      </TableCell>
                      <TableCell>
                        <span className="flex justify-end">
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={tm("edit", { name: model.displayName })}
                            onClick={() => setEditing(model)}
                          >
                            <Settings2Icon aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={tm("delete", { name: model.displayName })}
                            onClick={() => setRemoving(model)}
                          >
                            <Trash2Icon aria-hidden="true" />
                          </button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-col gap-2 md:flex-row">
            <Button
              prominence="secondary"
              size="sm"
              disabled={!provider.hasKey}
              onClick={fetchModels}
            >
              {t("fetch")}
            </Button>
            <Button prominence="tertiary" size="sm" onClick={() => setAsking("add")}>
              {t("addModel")}
            </Button>
          </div>
        </div>
      )}

      {/* Each dialog is mounted while it is open, so it starts from what the page shows now. */}
      {asking === "edit" && (
        <ProviderDialog
          open
          onOpenChange={() => setAsking(null)}
          preset={chatPresets.find((each) => each.id === preset) ?? chatPresets[0]}
          provider={provider}
        />
      )}
      {asking === "fetch" && (
        <FetchModels
          open
          onOpenChange={() => {
            setAsking(null);
            reported.reset();
          }}
          provider={provider}
          reported={reported}
          probe={probe}
        />
      )}
      {asking === "add" && (
        <ModelDialog open onOpenChange={() => setAsking(null)} provider={provider} />
      )}
      {editing && (
        <ModelDialog
          open
          onOpenChange={() => setEditing(null)}
          provider={provider}
          model={editing}
        />
      )}
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(next) => !next && setAsking(null)}
        title={td("providerTitle", { name: provider.name })}
        description={td("providerLead")}
        confirmLabel={td("providerConfirm")}
        cancelLabel={td("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() =>
          act(
            () => removeChatProvider({ path: { id: provider.id } }),
            () => notify.success("Admin.ai.chat.done.deleted", { name: provider.name }),
          )
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={td("modelTitle", { name: removing?.displayName ?? "" })}
        description={td("modelLead")}
        confirmLabel={td("modelConfirm")}
        cancelLabel={td("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => {
          const model = removing;
          if (model) {
            void act(
              () => removeChatModel({ path: { id: model.id } }),
              () => notify.success("Admin.ai.chat.done.modelRemoved", { name: model.displayName }),
            );
          }
        }}
      />
    </li>
  );
}

export { ConnectionCard };
