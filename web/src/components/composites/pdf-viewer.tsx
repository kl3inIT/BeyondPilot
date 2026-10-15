"use client";

import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, Loader2Icon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { actionVariants } from "@/components/actions/action-styles";
import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Said while the file, or the code that draws it, is on its way. */
function PdfLoading() {
  const t = useTranslations("PdfViewer");
  return (
    <p role="status" className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2Icon
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      />
      {t("loading")}
    </p>
  );
}

// PDF.js is loaded when a file is first opened, in the browser only: the page's first load does not
// carry it.
const PdfViewerPages = dynamic(() => import("./pdf-viewer-pages"), {
  ssr: false,
  loading: () => <PdfLoading />,
});

type PdfFile = {
  /** Where the file is read, on this origin; the same address downloads it. */
  url: string;
  name: string;
  /** What the file is and how large, as the list says it. */
  meta: string;
};

type PdfViewerProps = {
  files: PdfFile[];
  /** The file shown, from 0; `null` when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

/**
 * PDF files read in the page, full screen, instead of downloaded: every page one under the other,
 * where the reader is, a step to the other files with the arrows or the arrow keys, and the download
 * still at hand. Viewing here is a convenience, not a protection: the file can still be saved.
 */
function PdfViewer({ files, index, onIndexChange }: PdfViewerProps) {
  const t = useTranslations("PdfViewer");
  const file = index === null ? undefined : files[index];

  return (
    <Dialog open={file !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent showCloseButton={false} size="fullscreen" className="dark">
        {file && index !== null && (
          <PdfReader
            // A new file starts at its top, with its own count and its own failure.
            key={file.url}
            file={file}
            index={index}
            count={files.length}
            onStep={(step) => onIndexChange(index + step)}
            labels={{ close: t("close") }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type PdfReaderProps = {
  file: PdfFile;
  index: number;
  count: number;
  onStep: (step: -1 | 1) => void;
  labels: { close: string };
};

function PdfReader({ file, index, count, onStep, labels }: PdfReaderProps) {
  const t = useTranslations("PdfViewer");
  const [total, setTotal] = useState<number>();
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const several = count > 1;
  const hasPrevious = index > 0;
  const hasNext = index < count - 1;
  const onPage = useCallback((shown: number) => setPage(shown), []);
  const where = total === undefined ? undefined : t("pageOf", { page, total });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPrevious) {
        onStep(-1);
      }
      if (event.key === "ArrowRight" && hasNext) {
        onStep(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrevious, hasNext, onStep]);

  const download = (
    <a
      href={file.url}
      download={file.name}
      aria-label={t("download")}
      title={t("download")}
      className={cn(
        actionVariants({ tone: "default", prominence: "tertiary" }),
        "size-11 shrink-0 rounded-md p-0 [&_svg]:size-5",
      )}
    >
      <DownloadIcon aria-hidden="true" />
    </a>
  );

  return (
    <>
      <div className="flex items-center gap-2 border-b px-2 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col pl-2">
          <DialogTitle>
            <span className="block truncate">{file.name}</span>
          </DialogTitle>
          <DialogDescription>
            <span className="block truncate">
              {several ? t("meta", { meta: file.meta, index: index + 1, count }) : file.meta}
            </span>
          </DialogDescription>
        </div>
        {where && (
          <p
            aria-live="polite"
            className="hidden text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:block"
          >
            {where}
          </p>
        )}
        {download}
        <DialogClose
          render={<IconButton prominence="tertiary" size="lg" aria-label={labels.close} />}
        >
          <XIcon aria-hidden="true" />
        </DialogClose>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          role="region"
          aria-label={file.name}
          tabIndex={0}
          className="h-full overflow-y-auto overscroll-contain bg-muted px-3 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-20 sm:py-6"
        >
          {failed ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-medium">{t("failed")}</p>
              <Button href={file.url} download={file.name} prominence="secondary">
                {t("downloadInstead")}
              </Button>
            </div>
          ) : (
            <PdfViewerPages
              url={file.url}
              loading={<PdfLoading />}
              onOpened={setTotal}
              onPage={onPage}
              onFailed={() => setFailed(true)}
              pageLabel={(shown) => t("pageLabel", { page: shown })}
            />
          )}
        </div>
        {several && (
          <>
            <IconButton
              size="lg"
              aria-label={t("previous")}
              disabled={!hasPrevious}
              onClick={() => onStep(-1)}
              className="absolute top-1/2 left-4 hidden -translate-y-1/2 rounded-full shadow-card sm:inline-flex"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </IconButton>
            <IconButton
              size="lg"
              aria-label={t("next")}
              disabled={!hasNext}
              onClick={() => onStep(1)}
              className="absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-full shadow-card sm:inline-flex"
            >
              <ChevronRightIcon aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>

      {(several || where) && (
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1 sm:hidden">
          <TextButton
            disabled={!several || !hasPrevious}
            onClick={() => onStep(-1)}
            className="px-2 py-3"
          >
            <ChevronLeftIcon aria-hidden="true" />
            {t("previous")}
          </TextButton>
          <span className="text-xs text-muted-foreground tabular-nums">{where}</span>
          <TextButton
            disabled={!several || !hasNext}
            onClick={() => onStep(1)}
            className="px-2 py-3"
          >
            {t("next")}
            <ChevronRightIcon aria-hidden="true" />
          </TextButton>
        </div>
      )}
    </>
  );
}

export { PdfViewer, type PdfFile };
