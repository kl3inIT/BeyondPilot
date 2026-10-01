import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { ActionSize, ActionTone } from "@/components/actions/action-styles";

const textButtonVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-sm font-medium whitespace-nowrap underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        default: "text-foreground",
        danger: "text-destructive",
      },
      size: {
        sm: "text-xs [&_svg:not([class*='size-'])]:size-3",
        md: "text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "text-base [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

type TextButtonProps = ButtonPrimitive.Props & {
  tone?: ActionTone;
  size?: ActionSize;
};

/** A text-only action, such as "Browse programs →" under a section. */
function TextButton({ className, tone = "default", size = "md", ...props }: TextButtonProps) {
  return (
    <ButtonPrimitive
      type="button"
      {...props}
      data-slot="text-button"
      data-tone={tone}
      className={cn(textButtonVariants({ tone, size }), className)}
    />
  );
}

export { TextButton, type TextButtonProps };
