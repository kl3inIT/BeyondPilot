import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

import {
  actionVariants,
  type ActionProminence,
  type ActionSize,
  type ActionTone,
} from "@/components/actions/action-styles";

const buttonSizes = cva("", {
  variants: {
    size: {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4",
      lg: "h-10 px-6",
    },
  },
  defaultVariants: { size: "md" },
});

type ButtonProps = ButtonPrimitive.Props & {
  tone?: ActionTone;
  prominence?: ActionProminence;
  size?: ActionSize;
  /** Shows a spinner, blocks activation and sets `aria-busy` while an action runs. */
  pending?: boolean;
};

/**
 * Product action button. Links render through `render` (`<Button render={<Link href="…" />}
 * nativeButton={false}>`) so they keep link semantics and the action look.
 */
function Button({
  className,
  tone = "default",
  prominence = "primary",
  size = "md",
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      type="button"
      {...props}
      data-slot="button"
      data-tone={tone}
      data-prominence={prominence}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(actionVariants({ tone, prominence }), buttonSizes({ size }), className)}
    >
      {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, type ButtonProps };
