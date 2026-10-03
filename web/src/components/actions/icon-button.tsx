import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import {
  actionVariants,
  type ActionProminence,
  type ActionSize,
  type ActionTone,
} from "@/components/actions/action-styles";

// Icon-only actions keep 8px corners rather than the pill; `lg` is the 44px control of the mobile
// header and menu (DESIGN.md › Buttons › Touch).
const iconButtonSizes = cva("rounded-md p-0", {
  variants: {
    size: {
      sm: "size-8",
      md: "size-9",
      lg: "size-11 [&_svg:not([class*='size-'])]:size-5",
    },
  },
  defaultVariants: { size: "md" },
});

/** An icon-only control must name itself for assistive technology. */
type AccessibleName =
  | { "aria-label": string; "aria-labelledby"?: string }
  | { "aria-label"?: string; "aria-labelledby": string };

type IconButtonProps = Omit<ButtonPrimitive.Props, "aria-label" | "aria-labelledby"> &
  AccessibleName & {
    tone?: ActionTone;
    prominence?: ActionProminence;
    size?: ActionSize;
  };

function IconButton({
  className,
  tone = "default",
  prominence = "secondary",
  size = "md",
  ...props
}: IconButtonProps) {
  return (
    <ButtonPrimitive
      type="button"
      {...props}
      data-slot="icon-button"
      data-tone={tone}
      data-prominence={prominence}
      className={cn(actionVariants({ tone, prominence }), iconButtonSizes({ size }), className)}
    />
  );
}

export { IconButton, type IconButtonProps };
