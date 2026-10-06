"use client";

import { FileTextIcon, FileUpIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { uploadFile } from "@/lib/storage/upload";

import { useFileSize } from "./solution-deck";
import type { HeldDeck } from "./solution-editor-state";

/** What the backend accepts as a solution's deck (storage › FilePurpose.SOLUTION_DECK). */
const accepted = "application/pdf";
const maxBytes = 25 * 1024 * 1024;

type DeckUploadProps = {
  /** The id of the control that chooses a file, so a label and a link from another step reach it. */
  id: string;
  deck: HeldDeck | null;
  /** Where the deck is read, once the solution names this file; absent for one not saved yet. */
  href?: string;
  onChange: (deck: HeldDeck | null) => void;
};

/**
 * A solution's deck: one PDF, uploaded at once and named by the solution with its next save. The
 * backend removes a deck the solution no longer names.
 */
function DeckUpload({ id, deck, href, onChange }: DeckUploadProps) {
  const t = useTranslations("Solution.editor.deck");
  const format = useFormatter();
  const size = useFileSize();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [problem, setProblem] = useState<"type" | "size" | "failed" | null>(null);

  async function upload(file: File) {
    setProblem(null);
    if (file.type !== accepted) {
      setProblem("type");
      return;
    }
    if (file.size > maxBytes) {
      setProblem("size");
      return;
    }
    setUploading(file.name);
    try {
      const stored = await uploadFile(file, "solution_deck");
      onChange({
        fileId: stored.id,
        fileName: stored.fileName,
        sizeBytes: stored.sizeBytes,
        attachedAt: null,
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setProblem(
        code === "STORAGE_MEDIA_TYPE_NOT_ALLOWED" || code === "STORAGE_CONTENT_MISMATCH"
          ? "type"
          : code === "STORAGE_FILE_TOO_LARGE"
            ? "size"
            : "failed",
      );
    } finally {
      setUploading(null);
      if (input.current) {
        input.current.value = "";
      }
    }
  }

  const choose = () => input.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={accepted}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      {uploading ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border bg-background p-4 text-muted-foreground"
        >
          <Spinner />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{uploading}</span>
            <span className="text-xs">{t("uploading")}</span>
          </span>
        </div>
      ) : deck ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-4">
          <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            {href ? (
              <TextButton
                href={href}
                aria-label={t("download", { name: deck.fileName })}
                className="max-w-full self-start"
              >
                <span className="truncate">{deck.fileName}</span>
              </TextButton>
            ) : (
              <span className="truncate text-sm font-medium">{deck.fileName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {deck.attachedAt
                ? t("uploaded", {
                    size: size(deck.sizeBytes),
                    when: format.dateTime(new Date(deck.attachedAt), {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }),
                  })
                : t("waiting", { size: size(deck.sizeBytes) })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button id={id} prominence="secondary" size="sm" onClick={choose}>
              {t("replace")}
            </Button>
            <Button prominence="tertiary" tone="danger" size="sm" onClick={() => onChange(null)}>
              {t("remove")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={choose}
          data-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4 text-left transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-invalid:border-destructive"
        >
          <FileUpIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-sm font-medium">{t("empty")}</span>
            <span className="text-xs text-muted-foreground">{t("limits")}</span>
          </span>
        </button>
      )}
      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-sm text-destructive">
          {t(`errors.${problem}`)}
        </p>
      )}
    </div>
  );
}

export { DeckUpload };
