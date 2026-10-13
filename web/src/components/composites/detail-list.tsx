import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const detailListVariants = cva("text-sm", {
  variants: {
    /**
     * `stacked`: each label above its value, in a grid of `columns`. `rows`: each label beside its
     * value, a third of the width, for a narrow panel. `framed`: stacked, one fact a row in a box.
     */
    layout: {
      stacked: "grid gap-x-6 gap-y-3",
      rows: "grid grid-cols-3 gap-x-4 gap-y-2",
      framed: "flex flex-col divide-y rounded-lg border",
    },
    /** How many facts a row holds once there is room, for the `stacked` layout; a phone shows one. */
    columns: {
      1: "",
      2: "sm:grid-cols-2",
      4: "sm:grid-cols-2 lg:grid-cols-4",
    },
  },
  defaultVariants: { layout: "stacked", columns: 1 },
});

type Detail = {
  key: string;
  /** What the fact is; it may carry a help control beside it. */
  label: React.ReactNode;
  /** The fact itself, already written: a text, a link, a status. The caller says when there is none. */
  value: React.ReactNode;
};

type DetailListProps = Omit<React.ComponentProps<"dl">, "children"> &
  VariantProps<typeof detailListVariants> & {
    details: readonly Detail[];
  };

/**
 * The facts of a record, each a label and its value, as Medusa's `SectionRow`: one label size and one
 * value size on every record page, whichever way the facts are laid out.
 */
function DetailList({ details, layout, columns, className, ...props }: DetailListProps) {
  const rows = layout === "rows";
  return (
    <dl
      data-slot="detail-list"
      className={cn(detailListVariants({ layout, columns }), className)}
      {...props}
    >
      {details.map((detail) => (
        <div
          key={detail.key}
          className={cn(
            rows ? "contents" : "flex min-w-0 flex-col gap-0.5",
            layout === "framed" && "px-4 py-2.5",
          )}
        >
          <dt
            className={cn(
              "flex items-center gap-1 text-muted-foreground",
              rows ? "text-sm" : "text-xs",
            )}
          >
            {detail.label}
          </dt>
          <dd className={cn("min-w-0 break-words", rows && "col-span-2")}>{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { DetailList, type Detail };
