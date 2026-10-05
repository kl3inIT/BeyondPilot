import { cva, type VariantProps } from "class-variance-authority";

import { initials } from "@/lib/initials";

const solutionLogoVariants = cva(
  "flex shrink-0 items-center justify-center border bg-background font-semibold text-muted-foreground select-none",
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

type SolutionLogoProps = Required<VariantProps<typeof solutionLogoVariants>> & {
  /** The solution's name; its initials stand in the slot, because a solution has no logo image yet. */
  name: string;
};

/** The logo slot of a solution or its organization, on a card and at the head of a page. */
function SolutionLogo({ name, size }: SolutionLogoProps) {
  return (
    <span data-slot="solution-logo" aria-hidden="true" className={solutionLogoVariants({ size })}>
      {initials(name, name)}
    </span>
  );
}

export { SolutionLogo };
