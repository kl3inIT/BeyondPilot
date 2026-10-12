"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
import { Status } from "@/components/composites/status";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNotify } from "@/hooks/use-notify";
import {
  listReportedChatModels,
  type ProbeChatProvider,
  type ReportedChatModel,
  type SaveChatModel,
} from "@/lib/api/generated";

import { price, tokens } from "./chat-presets";
import { ModelLogo } from "./model-logo";

/** What a provider listed, and which of it the operator ticked. */
function useReportedModels() {
  const notify = useNotify();
  const [models, setModels] = useState<ReportedChatModel[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [listing, setListing] = useState(false);

  return {
    models,
    selected,
    listing,
    /** Reads the provider's models with a connection, saved or not. */
    async list(probe: ProbeChatProvider) {
      setListing(true);
      try {
        const { data } = await listReportedChatModels({ body: probe });
        setModels(data.models);
        setSelected(new Set());
      } catch (error) {
        notify.failure(error);
      } finally {
        setListing(false);
      }
    },
    toggle(name: string, on: boolean) {
      const next = new Set(selected);
      if (on) {
        next.add(name);
      } else {
        next.delete(name);
      }
      setSelected(next);
    },
    /** Forgets the list: the connection it was read with has changed, or the dialog closed. */
    reset() {
      setModels(null);
      setSelected(new Set());
    },
    /** The ticked models as the backend takes them, with what the provider and the catalog know. */
    chosen(): SaveChatModel[] {
      return (models ?? [])
        .filter((model) => selected.has(model.modelName) && !model.configured)
        .map((model) => ({
          modelName: model.modelName,
          displayName: null,
          contextWindow: model.contextWindow,
          maxOutputTokens: model.maxOutputTokens ?? null,
          inputPrice: model.inputPrice ?? null,
          outputPrice: model.outputPrice ?? null,
          cachedInputPrice: model.cachedInputPrice ?? null,
          toolCalling: model.toolCalling,
          vision: model.vision,
          reasoning: model.reasoning,
          version: 0,
        }));
    },
  };
}

type ModelsFieldProps = {
  reported: ReturnType<typeof useReportedModels>;
  /** The connection to list with; null while the form cannot name one yet. */
  probe: ProbeChatProvider | null;
};

/**
 * The models a provider lists, to tick the ones BeyondPilot may use. A model already enabled is
 * shown ticked and cannot be ticked again.
 */
function ModelsField({ reported, probe }: ModelsFieldProps) {
  const t = useTranslations("Admin.ai.chat.modelsField");
  const tm = useTranslations("Admin.ai.chat.models");
  const id = useId();
  const [query, setQuery] = useState("");
  const { models, selected } = reported;
  const shown = (models ?? []).filter((model) =>
    model.modelName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section aria-labelledby={`${id}-label`} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={`${id}-label`} className="text-sm font-medium">
            {t("label")}
          </h3>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {models
              ? t("count", { shown: shown.length, total: models.length, selected: selected.size })
              : null}
          </p>
        </div>
        <Button
          prominence="secondary"
          size="sm"
          pending={reported.listing}
          disabled={probe === null}
          onClick={() => probe && void reported.list(probe)}
        >
          {models ? t("refresh") : t("list")}
        </Button>
      </div>
      {models && models.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}
      {models && models.length > 0 && (
        <>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={t("searchLabel")}
              placeholder={t("search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
          {/* The frame is a column no taller than 16rem, so the one scroller inside it scrolls the
              list both ways and every column is in reach of a phone. */}
          <DataTable label={t("label")} className="flex max-h-64 flex-col">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{tm("model")}</TableHead>
                <TableHead className="text-right">{tm("context")}</TableHead>
                <TableHead className="text-right">{tm("input")}</TableHead>
                <TableHead className="text-right">{tm("output")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((model) => (
                <TableRow key={model.modelName}>
                  <TableCell>
                    <Checkbox
                      aria-label={t("select", { name: model.modelName })}
                      checked={model.configured || selected.has(model.modelName)}
                      disabled={model.configured}
                      onCheckedChange={(on) => reported.toggle(model.modelName, on)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <ModelLogo modelName={model.modelName} />
                      <span className="break-all">{model.modelName}</span>
                      {model.configured && (
                        <Status tone="success" appearance="pill">
                          {t("configured")}
                        </Status>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{tokens(model.contextWindow)}</TableCell>
                  <TableCell className="text-right">{price(model.inputPrice)}</TableCell>
                  <TableCell className="text-right">{price(model.outputPrice)}</TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <span className="text-muted-foreground">{t("noMatch")}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </DataTable>
        </>
      )}
    </section>
  );
}

export { ModelsField, useReportedModels };
