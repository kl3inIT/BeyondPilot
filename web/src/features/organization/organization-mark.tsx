import { cn } from "cn";
import Image from "next/image";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

/** The side of the mark in pixels: `sm` in a list row, beside two lines of text. */
const sides = { default: 44, sm: 32 } as const;

type OrganizationMarkProps = {
  name: string;
  /** The stored logo; without one the mark holds the organization's initials. */
  logoFileId?: string | null;
  size?: keyof typeof sides;
};

/** An organization's logo as uploaded, or its initials in a rounded square where it has none. */
function OrganizationMark({ name, logoFileId, size = "default" }: OrganizationMarkProps) {
  const box = size === "sm" ? "size-8" : "size-11";
  if (logoFileId) {
    return (
      <Image
        src={publicFileUrl(logoFileId)}
        alt=""
        width={sides[size]}
        height={sides[size]}
        unoptimized
        className={cn(box, "shrink-0 rounded-lg object-contain")}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
        size === "sm" ? "text-xs" : "text-sm",
      )}
    >
      {initials(name, name)}
    </span>
  );
}

export { OrganizationMark };
