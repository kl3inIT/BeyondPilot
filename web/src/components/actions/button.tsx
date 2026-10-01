import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

import { ActionLink, type ActionLinkProps } from "@/components/actions/action-link";
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

type ButtonLook = {
  tone?: ActionTone;
  prominence?: ActionProminence;
  size?: ActionSize;
};

type ButtonProps = ButtonLook &
  (
    | (ButtonPrimitive.Props & {
        href?: undefined;
        /** Shows a spinner, blocks activation and sets `aria-busy` while an action runs. */
        pending?: boolean;
      })
    | ActionLinkProps
  );

/**
 * Product action button. With `href` it renders a real link that looks like the action
 * (`<Button href="/programs">`); without it, a button.
 */
function Button({
  className,
  tone = "default",
  prominence = "primary",
  size = "md",
  ...rest
}: ButtonProps) {
  const look = cn(actionVariants({ tone, prominence }), buttonSizes({ size }), className);

  if (rest.href !== undefined) {
    return (
      <ActionLink
        {...rest}
        data-slot="button"
        data-tone={tone}
        data-prominence={prominence}
        className={look}
      />
    );
  }

  const { pending = false, disabled, children, ...props } = rest;

  return (
    <ButtonPrimitive
      type="button"
      {...props}
      data-slot="button"
      data-tone={tone}
      data-prominence={prominence}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={look}
    >
      {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, type ButtonProps };
