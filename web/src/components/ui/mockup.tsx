import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Device-less product screenshot frame (from the Launch UI registry).
const mockupVariants = cva(
  "relative z-10 flex overflow-hidden border border-border/70 shadow-2xl dark:border-border/5 dark:border-t-border/15",
  {
    variants: {
      type: {
        mobile: "max-w-[350px] rounded-[48px]",
        responsive: "rounded-md",
        // Sits inside a MockupFrame: the frame draws the edge, the screen only rounds.
        inset: "rounded-lg border-0 bg-background",
      },
    },
    defaultVariants: { type: "responsive" },
  },
);

function Mockup({
  className,
  type,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof mockupVariants>) {
  return <div data-slot="mockup" className={cn(mockupVariants({ type }), className)} {...props} />;
}

const frameVariants = cva(
  "relative z-10 flex overflow-hidden rounded-2xl bg-muted/5 dark:bg-border/10",
  {
    variants: {
      size: {
        small: "p-2",
        large: "p-4",
      },
    },
    defaultVariants: { size: "small" },
  },
);

function MockupFrame({
  className,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof frameVariants>) {
  return (
    <div data-slot="mockup-frame" className={cn(frameVariants({ size }), className)} {...props} />
  );
}

export { Mockup, MockupFrame };
