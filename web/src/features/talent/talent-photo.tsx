import Image from "next/image";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";
import { cn } from "cn";

type TalentPhotoProps = {
  name: string;
  /** The stored photo; without one the place holds the person's initials. */
  photoFileId?: string | null;
  /** The photo's width and height in pixels. */
  size: number;
  /** What the photo shows, for a reader who cannot see it; empty where the name stands beside it. */
  alt?: string;
  className?: string;
};

/** A person's photo in a circle, or their initials where they have none. */
function TalentPhoto({ name, photoFileId, size, alt = "", className }: TalentPhotoProps) {
  if (photoFileId) {
    return (
      <Image
        src={publicFileUrl(photoFileId)}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 rounded-full border object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-primary",
        className,
      )}
    >
      {initials(name, name)}
    </div>
  );
}

export { TalentPhoto };
