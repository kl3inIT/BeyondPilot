import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * A landing section as the Figma frames draw it: at most 1312px wide, centred, 16px side padding on
 * phones and 32px from `sm`, with the vertical rhythm of the Launch UI blocks.
 */
const sectionVariants = cva("mx-auto w-full max-w-328 px-4 sm:px-8", {
  variants: {
    spacing: {
      default: "py-16 sm:py-20",
      compact: "py-12 sm:py-20",
      // The bottom edge belongs to an illustration that bleeds into the next section.
      openBottom: "pt-12 sm:pt-20",
      // A tall opening before a large illustration (Launch UI "Feature / Rising").
      rising: "pt-16 sm:pt-32",
      // The content sets its own padding, as the CTA does around its glow.
      none: "",
    },
  },
  defaultVariants: { spacing: "default" },
});

function Section({
  className,
  spacing,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof sectionVariants>) {
  return (
    <section
      data-slot="section"
      className={cn(sectionVariants({ spacing }), className)}
      {...props}
    />
  );
}

export { Section };
