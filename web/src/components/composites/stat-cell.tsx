import { cva, type VariantProps } from "class-variance-authority";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const statStripVariants = cva("grid overflow-hidden rounded-lg border", {
  variants: {
    /** How many cells a row holds once there is room; a phone always shows two. */
    columns: {
      2: "grid-cols-2 lg:grid-cols-1",
      4: "grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
    },
  },
  defaultVariants: { columns: 4 },
});

type StatStripProps = React.ComponentProps<"dl"> & VariantProps<typeof statStripVariants>;

/**
 * Figures that belong together, as one band whose cells share hairlines rather than a card each
 * (docs/conventions.md › Charts). Two columns stack the cells beside a wider block from 1024px.
 */
function StatStrip({ className, columns, ...props }: StatStripProps) {
  return (
    <dl
      data-slot="stat-strip"
      className={cn(statStripVariants({ columns }), className)}
      {...props}
    />
  );
}

type StatCellProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the figure is. With `href` it is the link's name, and the whole cell is its target. */
  label: string;
  /** The figure, already formatted, or a `CountingNumber` where it changes in place. */
  value: React.ReactNode;
  /** The page behind the figure. */
  href?: string;
  /** What stands before the label, such as a warning mark. */
  icon?: React.ReactNode;
  /** A figure nobody needs to act on, such as an empty queue: it reads quieter. */
  quiet?: boolean;
  /** The odd cell out, last in a strip of five: it fills the rest of its row until the row holds all five. */
  wide?: boolean;
  /** What stands beside the figure, such as its `Sparkline`. */
  aside?: React.ReactNode;
  /** The one line under the figure: what it is made of, or what to do about it. */
  children?: React.ReactNode;
};

/** One figure of a `StatStrip`: its label above it, one line below, and room at its side. */
function StatCell({
  label,
  value,
  href,
  icon,
  quiet = false,
  wide = false,
  aside,
  className,
  children,
  ...props
}: StatCellProps) {
  return (
    <div
      data-slot="stat-cell"
      className={cn(
        // Each cell draws its own right and bottom hairline; the strip clips the outer ones.
        "relative -mr-px -mb-px flex flex-col gap-1 border-r border-b p-4",
        href !== undefined &&
          "transition-colors duration-fast hover:bg-muted has-focus-visible:bg-muted",
        // The odd cell out fills what is left of its row until every cell has a column of its own.
        wide && "col-span-2 xl:col-span-1",
        className,
      )}
      {...props}
    >
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        {href === undefined ? (
          label
        ) : (
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {label}
          </Link>
        )}
      </dt>
      <dd className="flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "text-2xl tracking-tight tabular-nums",
              quiet ? "font-normal text-muted-foreground" : "font-semibold",
            )}
          >
            {value}
          </span>
          {children !== undefined && (
            <span className="text-xs text-muted-foreground">{children}</span>
          )}
        </span>
        {aside}
      </dd>
    </div>
  );
}

export { StatCell, StatStrip };
