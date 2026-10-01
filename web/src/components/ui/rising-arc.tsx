import { cn } from "cn";

/**
 * The rising arc from the Launch UI "Feature / Rising" illustration, rebuilt from its Figma layers:
 * a wide blurred halo, a circle filled from transparent to the page colour, crescents of foreground,
 * brand and brand-foreground hugging the top edge, a brand rim fading downwards with a soft glow,
 * and a fade into the next section.
 */
function RisingArc({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="rising-arc"
      className={cn("relative aspect-[1248/535] w-full", className)}
      {...props}
    >
      {/* Halo behind the arc (Figma: brand-foreground 36%, blur 312). */}
      <div className="absolute top-[10%] left-1/2 h-[54%] w-[57%] -translate-x-1/2 rounded-[50%] bg-brand-foreground/35 blur-[120px]" />
      {/* The circle; only its top part shows. */}
      <div className="absolute top-0 left-[8%] aspect-square w-[84%] overflow-hidden rounded-full bg-linear-to-b from-background/0 via-background/20 via-16% to-background shadow-[inset_0_14px_24px_-6px_var(--foreground),inset_0_28px_32px_-12px_var(--brand),inset_0_80px_70px_-20px_color-mix(in_oklch,var(--brand-foreground)_40%,transparent)]" />
      {/* Brand rim, strongest at the crown and fading down the sides, with its glow. */}
      <div className="absolute top-0 left-[8%] aspect-square w-[84%] rounded-full border-[3px] border-brand [mask-image:linear-gradient(to_bottom,black_0%,transparent_45%)] shadow-[0_0_64px_var(--brand-foreground),0_0_8px_color-mix(in_oklch,var(--brand-foreground)_50%,transparent)]" />
      {/* Fade into the following section. */}
      <div className="absolute inset-x-0 bottom-0 h-[82%] bg-linear-to-b from-background/0 to-background to-70%" />
    </div>
  );
}

export { RisingArc };
