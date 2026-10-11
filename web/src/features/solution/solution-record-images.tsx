"use client";

import { cva } from "class-variance-authority";
import Image from "next/image";
import { useState } from "react";

import { publicFileUrl } from "@/lib/storage/upload";

import { SolutionImageDialog } from "./solution-image-dialog";

const pictureVariants = cva(
  "relative block h-14 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      shape: {
        square: "w-14",
        wide: "w-25",
      },
    },
  },
);

type SolutionRecordImage = {
  fileId: string;
  caption: string;
  label: string;
  shape: "square" | "wide";
};

type SolutionRecordImagesProps = {
  name: string;
  images: SolutionRecordImage[];
};

/** Small, labelled images in a review record that open in the shared image viewer. */
function SolutionRecordImages({ name, images }: SolutionRecordImagesProps) {
  const [open, setOpen] = useState<number | null>(null);
  const imageFileIds = images.map((image) => image.fileId);

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <li
            key={`${image.caption}-${image.fileId}`}
            className="flex flex-col items-center gap-1"
          >
            <button
              type="button"
              onClick={() => setOpen(index)}
              aria-label={image.label}
              className={pictureVariants({ shape: image.shape })}
            >
              <Image
                src={publicFileUrl(image.fileId)}
                alt=""
                fill
                sizes="100px"
                unoptimized
                className={
                  image.shape === "wide" ? "object-cover" : "object-contain"
                }
              />
            </button>
            <span className="text-xs text-muted-foreground">
              {image.caption}
            </span>
          </li>
        ))}
      </ul>
      <SolutionImageDialog
        name={name}
        imageFileIds={imageFileIds}
        openIndex={open}
        onOpenIndexChange={setOpen}
      />
    </>
  );
}

export { SolutionRecordImages };
