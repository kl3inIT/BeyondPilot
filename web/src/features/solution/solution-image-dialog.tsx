"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/actions/icon-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicFileUrl } from "@/lib/storage/upload";

type SolutionImageDialogProps = {
  name: string;
  imageFileIds: string[];
  openIndex: number | null;
  onOpenIndexChange: (index: number | null) => void;
};

/** One accessible, in-place viewer shared by the public gallery and the admin record. */
function SolutionImageDialog({
  name,
  imageFileIds,
  openIndex,
  onOpenIndexChange,
}: SolutionImageDialogProps) {
  const t = useTranslations("Solution.detail.gallery");
  const count = imageFileIds.length;
  const activeFileId = openIndex === null ? undefined : imageFileIds[openIndex];
  const step = (by: number) => {
    if (openIndex !== null && count > 1) {
      onOpenIndexChange((openIndex + by + count) % count);
    }
  };

  return (
    <Dialog
      open={openIndex !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenIndexChange(null);
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name })}</DialogTitle>
          <DialogDescription>
            {t("position", { position: (openIndex ?? 0) + 1, count })}
          </DialogDescription>
        </DialogHeader>
        {openIndex !== null && activeFileId && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <Image
              src={publicFileUrl(activeFileId)}
              alt={t("image", { name, position: openIndex + 1, count })}
              fill
              sizes="(min-width: 896px) 864px, 100vw"
              unoptimized
              className="object-contain"
            />
          </div>
        )}
        {count > 1 && (
          <div className="flex justify-center gap-2">
            <IconButton
              prominence="secondary"
              aria-label={t("previous")}
              onClick={() => step(-1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </IconButton>
            <IconButton
              prominence="secondary"
              aria-label={t("next")}
              onClick={() => step(1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { SolutionImageDialog };
