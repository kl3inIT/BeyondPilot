"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const collapsibleTriggerVariants = cva("", {
  variants: {
    variant: {
      default: "",
      section:
        "group/collapsible-section-trigger flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left outline-none",
    },
  },
  defaultVariants: { variant: "default" },
});

type CollapsibleTriggerProps = Omit<CollapsiblePrimitive.Trigger.Props, "className"> &
  VariantProps<typeof collapsibleTriggerVariants> & {
    className?: CollapsiblePrimitive.Trigger.Props["className"];
  };

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ className, variant, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      {...props}
      className={(state) =>
        cn(
          collapsibleTriggerVariants({ variant }),
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}

function CollapsibleContent({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      {...props}
      className={(state) =>
        cn(
          "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
          typeof className === "function" ? className(state) : className,
        )
      }
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
