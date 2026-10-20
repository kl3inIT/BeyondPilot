"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import { PdfViewer } from "@/components/composites/pdf-viewer";
import { useFormatter } from "@/i18n/format";

import type { UploadedAttachment } from "./admin-use-case-attachments";
import { openablePdfs } from "./use-case-attachment-files";

/**
 * The names of a use case's files, a PDF of them opening in the viewer; any other kind is only named,
 * as before.
 */
function SummaryAttachments({
  files,
  filesPath,
}: {
  files: UploadedAttachment[];
  /** Where a file the use case names is read, `<path>/<file id>`. */
  filesPath?: string;
}) {
  const t = useTranslations("Admin.useCases.form.attachments");
  const format = useFormatter();
  const [viewing, setViewing] = useState<number | null>(null);
  const pdfs = openablePdfs(
    files,
    filesPath,
    (bytes) => format.number(bytes / (1024 * 1024), { maximumFractionDigits: 1 }) + " MB",
  );

  return (
    <>
      {files.map((file, index) => {
        const at = pdfs.findIndex((pdf) => pdf.id === file.id);
        return (
          <Fragment key={file.id}>
            {index > 0 && ", "}
            {at < 0 ? (
              file.fileName
            ) : (
              <button
                type="button"
                aria-label={t("openFile", { name: file.fileName })}
                onClick={() => setViewing(at)}
                className="hit-area cursor-pointer rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {file.fileName}
              </button>
            )}
          </Fragment>
        );
      })}
      <PdfViewer files={pdfs} index={viewing} onIndexChange={setViewing} />
    </>
  );
}

export { SummaryAttachments };
