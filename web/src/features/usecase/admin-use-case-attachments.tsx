"use client";

import { FileTextIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { PdfViewer } from "@/components/composites/pdf-viewer";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useFailureWords } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { uploadFile, uploadWords } from "@/lib/storage/upload";
import { forgetUploaded, keepUploaded } from "@/lib/storage/uploaded-files";
import { momentText } from "@/i18n/formats";

import { openablePdfs } from "./use-case-attachment-files";

/** What the backend accepts as an attachment (storage › FilePurpose.USE_CASE_ATTACHMENT). */
const accepted = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/webp",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/csv",
  "text/plain",
];
const maxBytes = 25 * 1024 * 1024;
const maxAttachments = 10;

/** A file already uploaded, which the use case names when it is saved. */
export type UploadedAttachment = {
  id: string;
  fileName: string;
  /** What the file is; a PDF opens in the page. */
  mediaType: string;
  sizeBytes: number;
  /** When it was uploaded, as an instant; unknown for a file saved earlier. */
  uploadedAt?: string;
};

type AttachmentsFieldProps = {
  id: string;
  value: UploadedAttachment[];
  onChange: (value: UploadedAttachment[]) => void;
  /** Lists the files without the means to replace or add one. */
  readOnly?: boolean;
  /** Where a file the use case names is read, `<path>/<file id>`; none for a use case not saved yet. */
  filesPath?: string;
  /** What the form refuses about the files, said under them. */
  errors?: { message?: string }[];
};

/**
 * The files that explain a use case. Each is uploaded at once; the form names them when it is
 * saved. A file is replaced in its place, or another is added.
 */
function AttachmentsField({
  id,
  value,
  onChange,
  readOnly = false,
  filesPath,
  errors,
}: AttachmentsFieldProps) {
  const t = useTranslations("Admin.useCases.form.attachments");
  const words = useFailureWords();
  const format = useFormatter();
  const input = useRef<HTMLInputElement>(null);
  /** Which file the next choice replaces; none when it adds one. */
  const target = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  function choose(index: number | null) {
    target.current = index;
    input.current?.click();
  }

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
      const stored = await uploadFile(file, "use_case_attachment");
      keepUploaded(stored.id, file);
      const uploaded = {
        id: stored.id,
        fileName: stored.fileName,
        mediaType: stored.mediaType,
        sizeBytes: stored.sizeBytes,
        uploadedAt: new Date().toISOString(),
      };
      const index = target.current;
      const replaced = index === null ? undefined : value[index];
      if (replaced) {
        forgetUploaded(replaced.id);
      }
      onChange(
        index === null
          ? [...value, uploaded]
          : value.map((old, at) => (at === index ? uploaded : old)),
      );
    } catch (error) {
      setProblem(
        words(
          error,
          uploadWords({
            type: "Admin.useCases.form.attachments.errors.type",
            size: "Admin.useCases.form.attachments.errors.size",
            failed: "Admin.useCases.form.attachments.errors.failed",
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
    bytes < 1024 * 1024
      ? format.number(bytes / 1024, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 })
      : format.number(bytes / (1024 * 1024), {
          style: "unit",
          unit: "megabyte",
          maximumFractionDigits: 1,
        });

  const pdfs = openablePdfs(value, filesPath, size);

  // The control a person sees stands for the field: the button that adds a file, or the first that
  // replaces one once the list is full. It carries the id the label names, the error and the hint,
  // and keeps its own words as its name.
  const control = readOnly ? null : value.length < maxAttachments ? "add" : 0;
  const shown = {
    id,
    "aria-labelledby": `${id}-name`,
    "aria-invalid": errors ? true : undefined,
    "aria-describedby":
      [`${id}-hint`, errors ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined,
  } as const;

  return (
    <Field data-invalid={errors ? true : undefined}>
      <FieldLabel htmlFor={id}>{t("label")}</FieldLabel>
      <input
        ref={input}
        type="file"
        accept={accepted.join(",")}
        className="sr-only"
        // The buttons below open it; on its own it would be a stop in the tab order nobody can see.
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      <div className="flex flex-col gap-2">
        {value.map((file, index) => (
          <div key={file.id} className="flex items-center gap-3 rounded-xl border p-3">
            <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="grid min-w-0 flex-1 text-sm">
              <span className="truncate font-medium">{file.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {size(file.sizeBytes)}
                {file.uploadedAt &&
                  ` · ${t("uploaded", {
                    time: momentText(format, new Date(file.uploadedAt), "day"),
                  })}`}
              </span>
            </div>
            {pdfs.some((pdf) => pdf.id === file.id) && (
              <TextButton
                aria-label={t("openFile", { name: file.fileName })}
                onClick={() => setViewing(pdfs.findIndex((pdf) => pdf.id === file.id))}
              >
                {t("open")}
              </TextButton>
            )}
            {!readOnly && (
              <TextButton
                {...(control === index ? shown : {})}
                disabled={uploading}
                onClick={() => choose(index)}
              >
                <span id={control === index ? `${id}-name` : undefined}>{t("replace")}</span>
              </TextButton>
            )}
          </div>
        ))}
        {uploading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {t("uploading")}
          </p>
        )}
        {!readOnly && value.length < maxAttachments && (
          <TextButton
            {...(control === "add" ? shown : {})}
            className="self-start"
            disabled={uploading}
            onClick={() => choose(null)}
          >
            <PlusIcon aria-hidden="true" />
            <span id={`${id}-name`}>{t("add")}</span>
          </TextButton>
        )}
      </div>
      {!readOnly && (
        <FieldDescription id={`${id}-hint`}>
          {t("hint", { count: maxAttachments, size: size(maxBytes) })}
        </FieldDescription>
      )}
      <PdfViewer files={pdfs} index={viewing} onIndexChange={setViewing} />
      {problem && <FieldError>{problem}</FieldError>}
      {errors && <FieldError id={`${id}-error`} errors={errors} />}
    </Field>
  );
}

export { AttachmentsField };
