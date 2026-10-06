import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const statusDot = cva("size-2 shrink-0 rounded-full", {
  variants: {
    tone: {
      success: "bg-success",
      warning: "bg-warning",
      info: "bg-info",
      destructive: "bg-destructive",
      neutral: "bg-muted-foreground/50",
    },
  },
  defaultVariants: { tone: "neutral" },
});

/** The pastel ground of a pill and the ink that reads on it, by tone. */
const statusPill = cva(
  "inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        success: "bg-mint text-mint-foreground",
        warning: "bg-lemon text-lemon-foreground",
        info: "bg-sky text-sky-foreground",
        destructive: "bg-rose text-rose-foreground",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type StatusProps = React.ComponentProps<"span"> &
  VariantProps<typeof statusDot> & {
    /** A dot before the word, or the word on a pastel ground where a list is scanned by state. */
    appearance?: "dot" | "pill";
  };

/**
 * The state of a record as a dot and a word, or as a pill: the word carries the meaning, the colour
 * its tone. Which state of a domain takes which tone is decided beside that domain's code. A
 * `neutral` state reads quieter than the rest, as something switched off.
 */
function Status({
  tone = "neutral",
  appearance = "dot",
  className,
  children,
  ...props
}: StatusProps) {
  if (appearance === "pill") {
    return (
      <span
        data-slot="status"
        data-tone={tone}
        className={cn(statusPill({ tone }), className)}
        {...props}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      data-slot="status"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-2 text-sm",
        tone === "neutral" && "text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={statusDot({ tone })} />
      {children}
    </span>
  );
}

export { Status };
