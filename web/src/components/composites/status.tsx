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

type StatusProps = React.ComponentProps<"span"> & VariantProps<typeof statusDot>;

/**
 * The state of a record as a dot and a word: the word carries the meaning, the dot its tone. Which
 * state of a domain takes which tone is decided beside that domain's code. A `neutral` state reads
 * quieter than the rest, as something switched off.
 */
function Status({ tone = "neutral", className, children, ...props }: StatusProps) {
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
