"use client";

import { EllipsisIcon, PlugZapIcon, ScanTextIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import {
  removeOcrProvider,
  testOcrProvider,
  type OcrProvider,
  type OcrProviderTest,
} from "@/lib/api/generated";

import { chatError } from "./chat-errors";
import { ocrPresets, type OcrPreset } from "./ocr-presets";
import { OcrProviderDialog, OcrTestResult } from "./ocr-provider-dialog";

const iconButton =
  "hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 data-popup-open:bg-muted [&>svg]:size-4";

/** The sign of an OCR service in a framed square, beside its name. */
function OcrLogo() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground"
    >
      <ScanTextIcon className="size-4.5" />
    </span>
  );
}

/** The Connect button of an OCR service that can be added, and the dialog it opens. */
function ConnectOcrPreset({ preset }: { preset: OcrPreset }) {
  const t = useTranslations("Admin.ai.ocr.add");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        prominence="secondary"
        size="sm"
        aria-label={t("connectLabel", { name: preset.name })}
        onClick={() => setOpen(true)}
      >
        {t("connect")}
      </Button>
      {/* Mounted while open, so each connection starts from the preset and no typed key outlives it. */}
      {open && <OcrProviderDialog open onOpenChange={setOpen} preset={preset} />}
    </>
  );
}

/**
 * One connected OCR service: where it is, whether it has a key and is switched on, and whether it
 * reads documents. It can be tested, changed and deleted.
 */
function OcrConnectionCard({ provider }: { provider: OcrProvider }) {
  const t = useTranslations("Admin.ai.ocr.connections");
  const td = useTranslations("Admin.ai.ocr.delete");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<"edit" | "delete" | null>(null);
  const [result, setResult] = useState<OcrProviderTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [pending, setPending] = useState(false);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const { data } = await testOcrProvider({
        body: {
          providerId: provider.id,
          adapterType: provider.adapterType,
          baseUrl: provider.baseUrl,
          apiKey: null,
        },
      });
      setResult(data);
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await removeOcrProvider({ path: { id: provider.id } });
      notify.success("Admin.ai.ocr.done.deleted", { name: provider.name });
      router.refresh();
    } catch (error) {
      notify.error(chatError(error));
    } finally {
      setPending(false);
      setAsking(null);
    }
  }

  return (
    <li className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <OcrLogo />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="text-sm font-medium">{provider.name}</h3>
            {provider.inUse && <Badge variant="success">{t("inUse")}</Badge>}
            {!provider.hasKey && <Badge variant="outline">{t("noKey")}</Badge>}
            {!provider.enabled && <Badge variant="outline">{t("off")}</Badge>}
          </div>
          <span className="truncate text-xs text-muted-foreground">{provider.baseUrl}</span>
        </div>
        {provider.pricePerThousandCalls != null && (
          <span className="hidden text-xs text-muted-foreground md:inline">
            {t("price", { price: provider.pricePerThousandCalls })}
          </span>
        )}
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
      </div>

      {result && <OcrTestResult result={result} className="border-t px-4" />}

      {/* Mounted while it is open, so it starts from what the page shows now. */}
      {asking === "edit" && (
        <OcrProviderDialog
          open
          onOpenChange={() => setAsking(null)}
          preset={
            ocrPresets.find((each) => each.adapterType === provider.adapterType) ?? ocrPresets[0]
          }
          provider={provider}
        />
      )}
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(next) => !next && setAsking(null)}
        title={td("title", { name: provider.name })}
        description={td("lead")}
        confirmLabel={td("confirm")}
        cancelLabel={td("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => void remove()}
      />
    </li>
  );
}

export { ConnectOcrPreset, OcrConnectionCard, OcrLogo };
