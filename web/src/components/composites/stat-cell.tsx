import { cva, type VariantProps } from "class-variance-authority";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const statStripVariants = cva("grid overflow-hidden rounded-lg border", {
  variants: {
    /** How many cells a row holds once there is room; a phone always shows two. */
    columns: {
      2: "grid-cols-2 lg:grid-cols-1",
      4: "grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
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
  /** The figure, already formatted. */
  value: string;
  /** The page behind the figure. */
  href?: string;
  /** What stands before the label, such as a warning mark. */
  icon?: React.ReactNode;
  /** A figure nobody needs to act on, such as an empty queue: it reads quieter. */
  quiet?: boolean;
  /** The odd cell out fills the row at phone width. */
  wide?: boolean;
  /** The one line under the figure: what it is made of, or what to do about it. */
  children?: React.ReactNode;
};

/** One figure of a `StatStrip`: its label above it and one line below. */
function StatCell({
  label,
  value,
  href,
  icon,
  quiet = false,
  wide = false,
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
        wide && "col-span-2 md:col-span-1",
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
      <dd className="flex flex-col gap-1">
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
      </dd>
    </div>
  );
}

export { StatCell, StatStrip };
