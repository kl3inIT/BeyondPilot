"use client";

import { cn } from "cn";
import Image from "next/image";
import { useState } from "react";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

/** The side of the mark in pixels: `sm` in a list row, beside two lines of text. */
const sides = { default: 44, sm: 32, card: 136 } as const;

type OrganizationMarkProps = {
  name: string;
  /** The stored logo; without one the mark holds the organization's initials. */
  logoFileId?: string | null;
  size?: keyof typeof sides;
};

/**
 * An organization's logo as uploaded, or its initials in a rounded square where it has none. A
 * file that fails to load falls back to the initials, never the broken-image glyph.
 */
function OrganizationMark({ name, logoFileId, size = "default" }: OrganizationMarkProps) {
  const box =
    size === "sm" ? "size-8" : size === "card" ? "size-12 md:size-24 xl:size-34" : "size-11";
  const letters = initials(name, name);
  const fallback =
    letters.length > 1 ? letters : Array.from(name.trim()).slice(0, 2).join("").toLocaleUpperCase();
  const [broken, setBroken] = useState(false);

  if (logoFileId && !broken) {
    return (
      <Image
        src={publicFileUrl(logoFileId)}
        alt=""
        width={sides[size]}
        height={sides[size]}
        unoptimized
        className={cn(box, "shrink-0 rounded-lg object-contain")}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
        size === "sm" ? "text-xs" : size === "card" ? "text-lg md:text-2xl" : "text-sm",
      )}
    >
      {fallback}
    </span>
  );
}

export { OrganizationMark };
