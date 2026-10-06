"use client";

import { ImageUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ApiError } from "@/lib/api/client";
import { uploadFile } from "@/lib/storage/upload";

import { TalentPhoto } from "./talent-photo";

/** What the backend accepts as a talent photo (storage › FilePurpose.TALENT_PHOTO). */
const accepted = ["image/png", "image/jpeg", "image/webp"];
const maxBytes = 2 * 1024 * 1024;

type TalentPhotoUploadProps = {
  name: string;
  /** The stored photo, or empty for none. */
  value: string;
  onChange: (fileId: string) => void;
};

/**
 * The photo of a talent profile: uploaded at once, named by the profile when it is saved. The
 * backend removes a photo the profile no longer names.
 */
function TalentPhotoUpload({ name, value, onChange }: TalentPhotoUploadProps) {
  const t = useTranslations("Talent.form.photo");
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
      const stored = await uploadFile(file, "talent_photo");
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
    <div className="flex items-center gap-4">
      <TalentPhoto
        name={name}
        photoFileId={value}
        size={72}
        alt={t("alt")}
        className="size-18 text-xl"
      />
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          id="talent-photo"
          type="file"
          accept={accepted.join(",")}
          className="sr-only"
          aria-describedby="talent-photo-hint"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            prominence="secondary"
            size="sm"
            pending={uploading}
            onClick={() => input.current?.click()}
          >
            <ImageUpIcon aria-hidden="true" />
            {uploading ? t("uploading") : t(value ? "change" : "choose")}
          </Button>
          {value && !uploading && (
            <Button prominence="tertiary" size="sm" onClick={() => onChange("")}>
              {t("remove")}
            </Button>
          )}
        </div>
        <p id="talent-photo-hint" className="text-sm text-muted-foreground">
          {problem ?? t("hint")}
        </p>
      </div>
    </div>
  );
}

export { TalentPhotoUpload };
