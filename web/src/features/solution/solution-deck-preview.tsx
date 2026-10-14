"use client";

import { ExternalLinkIcon, EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type SolutionDeckPreviewProps = {
  fileName: string;
  /** An authorized deck address, or a temporary browser URL for a deck not saved yet. */
  fileUrl: string | undefined;
};

type PreviewLoad =
  { status: "loading" } | { status: "failed" } | { status: "ready"; source: string };

/** Loads a saved deck into a browser PDF viewer; a new upload already has a browser URL. */
function DeckPreviewBody({ fileName, fileUrl }: { fileName: string; fileUrl: string }) {
  const t = useTranslations("Solution.editor.deck");
  const [loaded, setLoaded] = useState<PreviewLoad>({ status: "loading" });

  useEffect(() => {
    if (fileUrl.startsWith("blob:")) {
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(fileUrl, { credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("PDF preview request failed");
        }
        return response.blob();
      })
      .then((file) => {
        objectUrl = URL.createObjectURL(file);
        setLoaded({ status: "ready", source: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoaded({ status: "failed" });
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileUrl]);

  const source = fileUrl.startsWith("blob:")
    ? fileUrl
    : loaded.status === "ready"
      ? loaded.source
      : null;

  return (
    <>
      {source ? (
        <iframe
          title={t("previewTitle", { name: fileName })}
          src={source}
          className="h-160 max-h-dvh w-full rounded-lg border bg-background"
        />
      ) : loaded.status === "failed" ? (
        <p role="alert" className="rounded-lg border bg-muted p-4 text-sm">
          {t("previewFailed")}
        </p>
      ) : (
        <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner />
          {t("previewLoading")}
        </p>
      )}
      <TextButton href={fileUrl} target="_blank" rel="noopener noreferrer" className="self-start">
        {t("download", { name: fileName })}
        <ExternalLinkIcon aria-hidden="true" />
      </TextButton>
    </>
  );
}

/** A PDF preview that works for saved, permission-checked decks and newly uploaded files. */
function SolutionDeckPreview({ fileName, fileUrl }: SolutionDeckPreviewProps) {
  const t = useTranslations("Solution.editor.deck");
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        type="button"
        prominence="tertiary"
        aria-label={t("previewNamed", { name: fileName })}
        title={t("previewNamed", { name: fileName })}
        disabled={!fileUrl}
        onClick={() => setOpen(true)}
      >
        <EyeIcon aria-hidden="true" />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="wrap-break-word">
              {t("previewTitle", { name: fileName })}
            </DialogTitle>
            <DialogDescription>{t("previewDescription")}</DialogDescription>
          </DialogHeader>
          {open && fileUrl && (
            <DeckPreviewBody key={fileUrl} fileName={fileName} fileUrl={fileUrl} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export { SolutionDeckPreview };
