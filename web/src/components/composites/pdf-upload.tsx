"use client";

import { FileTextIcon, FileUpIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { PdfViewer } from "@/components/composites/pdf-viewer";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";
import { useFailureWords } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { uploadFile, uploadWords } from "@/lib/storage/upload";
import { forgetUploaded, keepUploaded, readableAddress } from "@/lib/storage/uploaded-files";

/** What the backend accepts as a file of an application (storage › FilePurpose.APPLICATION_FILE). */
const maxBytes = 25 * 1024 * 1024;

/** A stored PDF as a record names it. */
type PdfFile = { fileId: string; fileName: string; sizeBytes: number };

type PdfUploadProps = {
  id: string;
  value: PdfFile | null;
  onChange: (file: PdfFile | null) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Draws the empty state as a roomy dashed zone with a plus in the middle, for a page of one file. */
  zone?: boolean;
  /** Where the file is read once a record names it, for the file the page did not upload itself. */
  savedAddress?: string;
};

/**
 * A private PDF of an application, such as a deck or a proposal: chosen, uploaded at once, then
 * replaced or removed. The record names the file when it is saved.
 */
function PdfUpload({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  zone,
  savedAddress,
}: PdfUploadProps) {
  const t = useTranslations("PdfUpload");
  const words = useFailureWords();
  const format = useFormatter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  async function upload(file: File) {
    setProblem(null);
    if (file.type !== "application/pdf") {
      setProblem(t("errors.type"));
      return;
    }
    if (file.size > maxBytes) {
      setProblem(t("errors.size"));
      return;
    }
    setUploading(true);
    try {
      const stored = await uploadFile(file, "application_file");
      keepUploaded(stored.id, file);
      if (value) {
        forgetUploaded(value.fileId);
      }
      onChange({ fileId: stored.id, fileName: stored.fileName, sizeBytes: stored.sizeBytes });
    } catch (error) {
      setProblem(
        words(
          error,
          uploadWords({
            type: "PdfUpload.errors.type",
            size: "PdfUpload.errors.size",
            failed: "PdfUpload.errors.failed",
          }),
        ),
      );
    } finally {
      setUploading(false);
      if (input.current) {
        input.current.value = "";
      }
    }
  }

  const size = (bytes: number) =>
    format.number(bytes / (1024 * 1024), { maximumFractionDigits: 1 }) + " MB";

  const address = value ? readableAddress(value.fileId, savedAddress) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf"
        className="sr-only"
        // The buttons below open it; on its own it would be a stop in the tab order nobody can see.
        tabIndex={-1}
        aria-describedby={describedBy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{value.fileName}</span>
            <span className="text-xs text-muted-foreground">{size(value.sizeBytes)}</span>
          </span>
          {value && address && (
            <>
              <Button
                prominence="tertiary"
                size="sm"
                aria-label={t("openFile", { name: value.fileName })}
                onClick={() => setViewing(0)}
              >
                {t("open")}
              </Button>
              <PdfViewer
                files={[{ url: address, name: value.fileName, meta: size(value.sizeBytes) }]}
                index={viewing}
                onIndexChange={setViewing}
              />
            </>
          )}
          <Button
            prominence="tertiary"
            size="sm"
            pending={uploading}
            onClick={() => input.current?.click()}
          >
            {t("replace")}
          </Button>
          <Button
            prominence="tertiary"
            tone="danger"
            size="sm"
            disabled={uploading}
            onClick={() => {
              forgetUploaded(value.fileId);
              onChange(null);
            }}
          >
            {t("remove")}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => input.current?.click()}
          aria-describedby={describedBy}
          className={
            zone
              ? cn(
                  "flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait",
                  invalid ? "border-destructive" : "border-input",
                )
              : invalid
                ? "flex w-full items-center gap-3 rounded-lg border border-dashed border-destructive p-4 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
                : "flex w-full items-center gap-3 rounded-lg border border-dashed border-input p-4 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
          }
        >
          {uploading ? (
            <span className="text-muted-foreground">
              <Spinner />
            </span>
          ) : zone ? (
            <PlusIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileUpIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
          <span className={cn("flex flex-col", zone && "items-center")}>
            <span className="text-sm font-medium">{uploading ? t("uploading") : t("empty")}</span>
            <span className="text-xs text-muted-foreground">{t("limits")}</span>
          </span>
        </button>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

export { PdfUpload, type PdfFile };
