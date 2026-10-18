"use client";

import { ImageUpIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Spinner } from "@/components/ui/spinner";
import { useFailureWords } from "@/hooks/use-notify";
import { publicFileUrl, uploadFile, uploadWords } from "@/lib/storage/upload";

/** What the backend accepts as a program's image (storage › FilePurpose.PROGRAM_IMAGE). */
const accepted = ["image/png", "image/jpeg", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

type CoverUploadProps = {
  /**
   * The id of the control a person sees: the button that adds a cover, or the one that replaces it.
   * The field's label and a link to the field name it, so the focus they move can be seen.
   */
  id: string;
  /** The stored file that is the cover, or empty for none. */
  value: string;
  onChange: (fileId: string) => void;
  invalid?: boolean;
  /**
   * Why the cover can be replaced but not removed, said under it: a published program keeps its
   * cover, and the backend refuses a save that takes it away.
   */
  kept?: string;
};

/**
 * A program's cover: the image as the list and the page show it, replaced or removed here. The file
 * is uploaded at once; the program names it when Settings is saved, and the backend removes a cover
 * the program no longer names. The file input only opens the browser's chooser: it is out of the tab
 * order and of the accessibility tree, and the button in view carries the id, the error state and
 * the name, which stays its own words under the field's label.
 */
function CoverUpload({ id, value, onChange, invalid, kept }: CoverUploadProps) {
  const t = useTranslations("Admin.programs.settings.cover");
  const words = useFailureWords();
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
      setProblem(
        words(
          error,
          uploadWords({
            type: "Admin.programs.settings.cover.errors.type",
            size: "Admin.programs.settings.cover.errors.size",
            failed: "Admin.programs.settings.cover.errors.failed",
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

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={accepted.join(",")}
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
              id={id}
              prominence="secondary"
              size="sm"
              pending={uploading}
              aria-labelledby={`${id}-name`}
              aria-invalid={invalid || undefined}
              onClick={() => input.current?.click()}
            >
              <span id={`${id}-name`}>{t("replace")}</span>
            </Button>
            <Button
              prominence="tertiary"
              tone="danger"
              size="sm"
              disabled={uploading || Boolean(kept)}
              aria-describedby={kept ? `${id}-kept` : undefined}
              onClick={() => onChange("")}
            >
              {t("remove")}
            </Button>
          </div>
          {kept && (
            <p id={`${id}-kept`} className="w-full text-sm text-muted-foreground">
              {kept}
            </p>
          )}
        </div>
      ) : (
        // The button stands for the file field, so it is what says the field is in error and what
        // takes the focus after a refused save (docs/conventions.md › Forms).
        <button
          id={id}
          type="button"
          disabled={uploading}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-limits`}
          // oxlint-disable-next-line jsx-a11y/role-supports-aria-props
          aria-invalid={invalid || undefined}
          onClick={() => input.current?.click()}
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
            <span id={`${id}-name`} className="text-sm font-medium">
              {uploading ? t("uploading") : t("empty")}
            </span>
            <span id={`${id}-limits`} className="text-xs text-muted-foreground">
              {t("limits")}
            </span>
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
