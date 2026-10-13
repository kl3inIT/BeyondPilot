import { cn } from "@/lib/utils";

type ChartFrameProps = Omit<React.ComponentProps<"figure">, "title"> & {
  /** What the chart shows. */
  title: React.ReactNode;
  /** One line that says what to read from it, or its figures as text. */
  lead?: React.ReactNode;
  /** The way to the page behind the chart, at the right of the title. */
  action?: React.ReactNode;
};

/**
 * The frame every chart sits in: its title, one line under it, an action, then the chart
 * (docs/conventions.md › Charts). The caller describes the chart itself for a screen reader.
 */
function ChartFrame({ title, lead, action, className, children, ...props }: ChartFrameProps) {
  return (
    <figure
      data-slot="chart-frame"
      className={cn("flex flex-col gap-4 rounded-lg border p-4", className)}
      {...props}
    >
      <figcaption className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          {lead !== undefined && lead !== null && (
            <span className="text-xs text-muted-foreground">{lead}</span>
          )}
        </span>
        {action}
      </figcaption>
      {children}
    </figure>
  );
}

export { ChartFrame };
