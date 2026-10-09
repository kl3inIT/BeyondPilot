"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import Image from "next/image";
import { useState } from "react";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

const solutionLogoVariants = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden border bg-background font-semibold text-muted-foreground select-none",
  {
    variants: {
      size: {
        row: "size-8 rounded-full text-xs",
        card: "size-12 rounded-xl text-sm",
        page: "size-14 rounded-2xl text-lg md:size-18 md:text-xl",
      },
    },
  },
);

/** The widest a logo is drawn at each size, so the browser asks for no more than that. */
const widths = { row: "32px", card: "48px", page: "72px" } as const;

type SolutionLogoProps = Required<VariantProps<typeof solutionLogoVariants>> & {
  /** The name of the solution; its initials stand in the slot without a logo. */
  name: string;
  /** The stored logo, read at the public address of stored files. */
  fileId?: string | null;
  className?: string;
};

/**
 * The logo slot of a solution, on a card and at the head of its page. The name stands beside it
 * wherever it is drawn, so the logo itself says nothing to a screen reader. When the file is gone
 * or fails to load the initials take its place, never the broken-image glyph.
 */
function SolutionLogo({ name, fileId, size, className }: SolutionLogoProps) {
  const [broken, setBroken] = useState(false);

  return (
    <span
      data-slot="solution-logo"
      aria-hidden="true"
      className={cn(solutionLogoVariants({ size }), className)}
    >
      {fileId && !broken ? (
        <Image
          src={publicFileUrl(fileId)}
          alt=""
          fill
          sizes={widths[size ?? "card"]}
          unoptimized
          className="object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        initials(name, name)
      )}
    </span>
  );
}

export { SolutionLogo };
