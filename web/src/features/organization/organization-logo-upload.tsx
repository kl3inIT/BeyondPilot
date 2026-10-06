"use client";

import { ImageUpIcon, Loader2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { IconButton } from "@/components/actions/icon-button";
import { ApiError } from "@/lib/api/client";
import { publicFileUrl, uploadFile } from "@/lib/storage/upload";
import { cn } from "cn";

/** What the backend accepts as an organization logo (storage › FilePurpose.ORGANIZATION_LOGO). */
const accepted = ["image/png", "image/jpeg", "image/webp"];
const maxBytes = 5 * 1024 * 1024;
const PREVIEW_SIZE = 160;

type OrganizationLogoUploadProps = {
  /** The stored logo, or empty for none. */
  value: string;
  onChange: (fileId: string) => void;
};

/**
 * The logo of an organization: one area to click or to drop an image on, which shows the logo once
 * it is uploaded. The upload happens at once; the profile names the logo when it is saved, and the
 * backend removes a logo the organization no longer names.
 */
function OrganizationLogoUpload({ value, onChange }: OrganizationLogoUploadProps) {
  const t = useTranslations("Organization.form.logo");
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
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
      const stored = await uploadFile(file, "organization_logo");
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

  function drop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !uploading) {
      void upload(file);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <button
          type="button"
          disabled={uploading}
          aria-label={t(value ? "change" : "upload")}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            "flex size-28 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-primary",
            !value && "border-2 border-dashed border-muted-foreground/40",
            dragging && "border-primary bg-accent text-primary",
          )}
        >
          {uploading ? (
            <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          ) : value ? (
            <Image
              src={publicFileUrl(value)}
              alt={t("alt")}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              unoptimized
              className="size-full object-contain p-3"
            />
          ) : (
            <ImageUpIcon className="size-6" aria-hidden="true" />
          )}
        </button>
        {value && !uploading && (
          <IconButton
            size="sm"
            aria-label={t("remove")}
            onClick={() => onChange("")}
            className="absolute top-2 right-2 rounded-full"
          >
            <XIcon aria-hidden="true" />
          </IconButton>
        )}
        <input
          ref={input}
          id="organization-logo"
          type="file"
          accept={accepted.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
          }}
        />
      </div>
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

export { OrganizationLogoUpload };
