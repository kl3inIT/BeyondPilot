"use client";

import { FileTextIcon, FileUpIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { uploadFile } from "@/lib/storage/upload";

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
};

/**
 * A private PDF of an application, such as a deck or a proposal: chosen, uploaded at once, then
 * replaced or removed. The record names the file when it is saved.
 */
function PdfUpload({ id, value, onChange, invalid, describedBy }: PdfUploadProps) {
  const t = useTranslations("PdfUpload");
  const format = useFormatter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
      onChange({ fileId: stored.id, fileName: stored.fileName, sizeBytes: stored.sizeBytes });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setProblem(
        code === "STORAGE_MEDIA_TYPE_NOT_ALLOWED" || code === "STORAGE_CONTENT_MISMATCH"
          ? t("errors.type")
          : code === "STORAGE_FILE_TOO_LARGE"
            ? t("errors.size")
            : t("errors.failed"),
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
            onClick={() => onChange(null)}
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
            invalid
              ? "flex w-full items-center gap-3 rounded-lg border border-dashed border-destructive p-4 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
              : "flex w-full items-center gap-3 rounded-lg border border-dashed border-input p-4 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
          }
        >
          {uploading ? (
            <span className="text-muted-foreground">
              <Spinner />
            </span>
          ) : (
            <FileUpIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="flex flex-col">
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
