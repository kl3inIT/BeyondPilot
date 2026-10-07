import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * A landing section as the Figma frames draw it: a full-bleed floor (Paper or Cool Paper) holding a
 * column of at most 1440px with 20px gutters on phones, 32px from `md` and 64px from `xl`. The
 * section's own vertical rhythm sits on the content inside, because each floor breathes
 * differently. The column is the positioning context for anything that floats in the section.
 */
const sectionVariants = cva("relative w-full", {
  variants: {
    surface: {
      default: "bg-background",
      muted: "bg-muted",
      // Lets the hero's aurora run on behind the strip under it.
      transparent: "bg-transparent",
    },
  },
  defaultVariants: { surface: "default" },
});

function Section({
  className,
  surface,
  children,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof sectionVariants>) {
  return (
    <section data-slot="section" className={cn(sectionVariants({ surface }), className)} {...props}>
      <div className="relative mx-auto w-full max-w-360 px-5 md:px-8 xl:px-16 desktop:px-20">
        {children}
      </div>
    </section>
  );
}

export { Section };
