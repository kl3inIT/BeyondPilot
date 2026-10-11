"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const avatarVariants = cva(
  "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
  {
    variants: {
      size: {
        default: "",
        sm: "",
        lg: "",
        // The sizes of a talent photo; the initials of the accent fallback follow the text size set here.
        xl: "size-12 text-sm",
        "2xl": "size-16 text-lg",
        "3xl": "size-18 text-xl",
        profile: "size-18 text-xl md:size-24 md:text-2xl",
      },
      tone: {
        default: "",
        talent: "ring-2 ring-talent/40 ring-offset-2 ring-offset-card",
      },
    },
    defaultVariants: {
      size: "default",
      tone: "default",
    },
  },
);

function Avatar({
  className,
  size = "default",
  tone = "default",
  ...props
}: AvatarPrimitive.Root.Props & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(avatarVariants({ size, tone }), className)}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full rounded-full object-cover", className)}
      {...props}
    />
  );
}

const avatarFallbackVariants = cva("flex size-full items-center justify-center rounded-full", {
  variants: {
    variant: {
      default: "bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
      // A person's own initials in a talent photo, at the size the avatar's text sets.
      accent: "bg-accent [font-size:inherit] font-semibold text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function AvatarFallback({
  className,
  variant = "default",
  ...props
}: AvatarPrimitive.Fallback.Props & VariantProps<typeof avatarFallbackVariants>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants({ variant }), className)}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
