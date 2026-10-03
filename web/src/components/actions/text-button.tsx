import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import { ActionLink, type ActionLinkProps } from "@/components/actions/action-link";
import type { ActionSize, ActionTone } from "@/components/actions/action-styles";

const textButtonVariants = cva(
  "hit-area inline-flex shrink-0 items-center gap-1 rounded-sm whitespace-nowrap underline-offset-4 transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        default: "text-primary",
        danger: "text-destructive",
      },
      size: {
        sm: "text-xs font-medium [&_svg:not([class*='size-'])]:size-3",
        md: "text-sm font-semibold [&_svg:not([class*='size-'])]:size-3.5",
        lg: "text-base font-semibold [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

type TextButtonProps = {
  tone?: ActionTone;
  size?: ActionSize;
} & ((ButtonPrimitive.Props & { href?: undefined }) | ActionLinkProps);

/** A text-only action in azure, such as "Publish a use case →" beside a heading. With `href` it is a link. */
function TextButton({ className, tone = "default", size = "md", ...props }: TextButtonProps) {
  if (props.href !== undefined) {
    return (
      <ActionLink
        {...props}
        data-slot="text-button"
        data-tone={tone}
        className={cn(textButtonVariants({ tone, size }), className)}
      />
    );
  }

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
