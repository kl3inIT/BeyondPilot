"use client";

import { ImageUpIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { publicFileUrl, uploadFile } from "@/lib/storage/upload";

/** What the backend accepts as a program's image (storage › FilePurpose.PROGRAM_IMAGE). */
const accepted = ["image/png", "image/jpeg", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

type CoverUploadProps = {
  id: string;
  /** The stored file that is the cover, or empty for none. */
  value: string;
  onChange: (fileId: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * A program's cover: the image as the list and the page show it, replaced or removed here. The file
 * is uploaded at once; the program names it when Settings is saved, and the backend removes a cover
 * the program no longer names.
 */
function CoverUpload({ id, value, onChange, invalid, describedBy }: CoverUploadProps) {
  const t = useTranslations("Admin.programs.settings.cover");
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function upload(file: File) {
    setProblem(null);
    if (!accepted.includes(file.type)) {
      setProblem(t("errors.type"));
      return;
    }
    if (file.size > maxBytes) {
      setProblem(t("errors.size"));
      return;
    }
    setUploading(true);
    try {
      const stored = await uploadFile(file, "program_image");
      onChange(stored.id);
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

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={accepted.join(",")}
        className="sr-only"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      {value ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Image
            src={publicFileUrl(value)}
            alt={t("alt")}
            width={192}
            height={108}
            unoptimized
            className="aspect-video w-full rounded-md border object-cover sm:w-48"
          />
          <div className="flex gap-2 sm:ml-auto">
            <Button
              prominence="secondary"
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
              onClick={() => onChange("")}
            >
              {t("remove")}
            </Button>
          </div>
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
            <ImageUpIcon className="size-5 text-muted-foreground" aria-hidden="true" />
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

export { CoverUpload };
