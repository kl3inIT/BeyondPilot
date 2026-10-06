import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import Image from "next/image";

import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

const solutionLogoVariants = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden border bg-background font-semibold text-muted-foreground select-none",
  {
    variants: {
      size: {
        card: "size-12 rounded-xl text-sm",
        profile: "size-11 rounded-lg text-sm",
        page: "size-14 rounded-2xl text-lg md:size-18 md:text-xl",
      },
    },
  },
);

/** The widest a logo is drawn at each size, so the browser asks for no more than that. */
const widths = { card: "48px", profile: "44px", page: "72px" } as const;

type SolutionLogoProps = Required<VariantProps<typeof solutionLogoVariants>> & {
  /** The name of the solution or the organization; its initials stand in the slot without a logo. */
  name: string;
  /** The stored logo, read at the public address of stored files. */
  fileId?: string | null;
  className?: string;
};

/**
 * The logo slot of a solution or its organization, on a card and at the head of a page. The name
 * stands beside it wherever it is drawn, so the logo itself says nothing to a screen reader.
 */
function SolutionLogo({ name, fileId, size, className }: SolutionLogoProps) {
  return (
    <span
      data-slot="solution-logo"
      aria-hidden="true"
      className={cn(solutionLogoVariants({ size }), className)}
    >
      {fileId ? (
        <Image
          src={publicFileUrl(fileId)}
          alt=""
          fill
          sizes={widths[size ?? "card"]}
          unoptimized
          className="object-contain"
        />
      ) : (
        initials(name, name)
      )}
    </span>
  );
}

export { SolutionLogo };
