"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/actions/icon-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicFileUrl } from "@/lib/storage/upload";

type SolutionGalleryProps = {
  /** What the solution is called, to name its images for a reader who cannot see them. */
  name: string;
  coverFileId?: string | null;
  /** The images under the cover, in their order. */
  imageFileIds: string[];
};

/**
 * What a solution shows of itself: its cover, and under it only the images it has, never an empty
 * place for one it lacks. Any of them opens large, with the others one step away.
 */
function SolutionGallery({ name, coverFileId, imageFileIds }: SolutionGalleryProps) {
  const t = useTranslations("Solution.detail.gallery");
  const [open, setOpen] = useState<number | null>(null);
  const files = [...(coverFileId ? [coverFileId] : []), ...imageFileIds];
  if (files.length === 0) {
    return null;
  }
  const count = files.length;
  // Without a cover the images stand alone, each a small tile.
  const small = coverFileId ? files.slice(1) : files;
  const offset = coverFileId ? 1 : 0;
  const step = (by: number) =>
    setOpen((current) => (current === null ? null : (current + by + count) % count));

  return (
    <div data-slot="solution-gallery" className="flex flex-col gap-3">
      {coverFileId && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          aria-label={t("open", { position: 1, count })}
          className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Image
            src={publicFileUrl(coverFileId)}
            alt={t("cover", { name })}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            unoptimized
            className="object-cover"
          />
        </button>
      )}
      {small.length > 0 && (
        // On a phone the row runs past the edge and scrolls; from 768px the images share the width in four columns.
        <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0">
          {small.map((fileId, index) => (
            <li key={fileId} className="w-40 shrink-0 md:w-auto">
              <button
                type="button"
                onClick={() => setOpen(index + offset)}
                aria-label={t("open", { position: index + offset + 1, count })}
                className="relative block aspect-video w-full overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Image
                  src={publicFileUrl(fileId)}
                  alt={t("image", { name, position: index + offset + 1, count })}
                  fill
                  sizes="(min-width: 768px) 15vw, 160px"
                  unoptimized
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("title", { name })}</DialogTitle>
            <DialogDescription>
              {t("position", { position: (open ?? 0) + 1, count })}
            </DialogDescription>
          </DialogHeader>
          {open !== null && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <Image
                src={publicFileUrl(files[open])}
                alt={t("image", { name, position: open + 1, count })}
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
              <IconButton prominence="secondary" aria-label={t("next")} onClick={() => step(1)}>
                <ChevronRightIcon aria-hidden="true" />
              </IconButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { SolutionGallery };
