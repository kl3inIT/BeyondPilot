import Image from "next/image";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

type OrganizationMarkProps = {
  name: string;
  /** The stored logo; without one the mark holds the organization's initials. */
  logoFileId?: string | null;
};

/** An organization's logo as uploaded, or its initials in a rounded square where it has none. */
function OrganizationMark({ name, logoFileId }: OrganizationMarkProps) {
  if (logoFileId) {
    return (
      <Image
        src={publicFileUrl(logoFileId)}
        alt=""
        width={44}
        height={44}
        unoptimized
        className="size-11 shrink-0 rounded-lg object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground"
    >
      {initials(name, name)}
    </span>
  );
}

export { OrganizationMark };
