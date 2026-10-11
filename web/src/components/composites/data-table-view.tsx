"use client";

import {
  createColumnHelper,
  functionalUpdate,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * How a column sits in the table, said in a few fixed words rather than classes, so that every list
 * lays its columns out the same way.
 */
type DataTableColumnMeta = {
  /** The column takes the room left, and its text is cut short with an ellipsis. */
  fill?: boolean;
  /** Its text stays on one line. */
  nowrap?: boolean;
  /** A number: aligned right. */
  numeric?: boolean;
  /** As narrow as a checkbox. */
  narrow?: boolean;
  /** A fixed width: `action` holds one icon button, `sm` 8rem, `md` 9rem, `lg` 14rem. */
  width?: "action" | "sm" | "md" | "lg";
  /** Shown only from this width on: a column the table does without when narrower. */
  from?: "sm" | "md" | "lg" | "xl";
  /** Its first click sorts the largest or latest first, as for a score or a date. */
  descFirst?: boolean;
};

/**
 * The parts of TanStack Table every list uses: sorting by a column header, which the server does,
 * and selecting rows. Anything not declared here is left out of the bundle.
 */
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnMeta: {} as DataTableColumnMeta,
});

type DataTableFeatures = typeof features;

/** A column of a list. A column is sortable when its id is one of the list's sort keys. */
type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

/** The helper that types the columns of a list of `TData`. */
function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** `?sort=score` sorts by score ascending, `?sort=-score` descending (docs/conventions.md › Lists). */
function sortingOf(sort: string): SortingState {
  if (sort === "") {
    return [];
  }
  const desc = sort.startsWith("-");
  return [{ id: desc ? sort.slice(1) : sort, desc }];
}

type DataTableSelection<TData> = {
  /** Whether a row may be selected; a row that may not shows its box disabled. */
  canSelect?: (row: TData) => boolean;
  /** The name of a row, read by the label of its box: "Select Plain Cover". */
  name: (row: TData) => string;
  /**
   * Every row the search and filters match, on every page, when the page knows them. With it,
   * selecting the whole page offers to select all of them.
   */
  matching?: string[];
  /** The actions on the selected rows, beside their count; `clear` empties the selection. */
  actions: (ids: string[], clear: () => void) => React.ReactNode;
};

type DataTableViewProps<TData extends RowData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  /** The columns a header click sorts by, as the server knows them. */
  sortKeys?: readonly string[];
  /** The order when the URL names none, as the server applies it: `-score`. */
  defaultSort?: string;
  selection?: DataTableSelection<TData>;
  /** What the table shows in place of rows: an empty list or a search that found nothing. */
  empty?: React.ReactNode;
  className?: string;
};

/**
 * A list as a table, on TanStack Table in manual mode, as Dub and Medusa build theirs: the server
 * reads the rows, sorts and pages them from the URL, and this draws them. A sortable header writes
 * `?sort=` and returns to page 1; a second click turns the order round. Selected rows gather in a
 * bar at the bottom of the screen with their actions, and selecting a whole page offers every row
 * that matches. Rows that leave the list leave the selection, and Escape empties it.
 */
function DataTableView<TData extends RowData>({
  columns,
  data,
  getRowId,
  sortKeys = [],
  defaultSort = "",
  selection,
  empty,
  className,
}: DataTableViewProps<TData>) {
  const t = useTranslations("Lists.table");
  const [, startTransition] = useTransition();
  const [query, setQuery] = useQueryStates(
    { sort: parseAsString.withDefault(""), page: parseAsInteger },
    { shallow: false, startTransition },
  );
  const sorting = sortingOf(query.sort || defaultSort);

  /** Sorts by a column: a new one starts its own way round, the current one turns round. */
  function sortBy(id: string, descFirst: boolean) {
    const [current] = sorting;
    const desc = current?.id === id ? !current.desc : descFirst;
    const next = `${desc ? "-" : ""}${id}`;
    void setQuery({ sort: next === defaultSort ? null : next, page: null });
  }
  const [picked, setPicked] = useState<string[]>([]);

  // Only rows still in the list count as selected: a filter or a page that drops one drops it here.
  const reachable = new Set(selection?.matching ?? data.map(getRowId));
  const selected = picked.filter((id) => reachable.has(id));
  const rowSelection: RowSelectionState = Object.fromEntries(
    selected.map((id) => [id, true as const]),
  );
  const clear = () => setPicked([]);
  const anySelected = selected.length > 0;

  // Escape empties the selection, as in Dub, unless a dialog or menu has the key.
  useEffect(() => {
    if (!anySelected) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setPicked([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anySelected]);

  const select: DataTableColumn<TData>[] = selection
    ? [
        {
          id: "select",
          enableSorting: false,
          meta: { narrow: true },
          header: ({ table }) => (
            <Checkbox
              aria-label={t("selectPage")}
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label={t("selectOne", { name: selection.name(row.original) })}
              disabled={!row.getCanSelect()}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            />
          ),
        },
      ]
    : [];

  const table = useTable({
    features,
    data,
    columns: [...select, ...columns],
    getRowId,
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    enableRowSelection: selection
      ? (row) => (selection.canSelect ? selection.canSelect(row.original) : true)
      : false,
    state: { sorting, rowSelection },
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      const next = Object.keys(functionalUpdate(updater, rowSelection));
      // Rows of other pages stay selected; the update speaks only for the rows of this one.
      const here = new Set(data.map(getRowId));
      setPicked((current) => [...current.filter((id) => !here.has(id)), ...next]);
    },
  });

  const matching = selection?.matching ?? [];
  const wholePage = table.getIsAllPageRowsSelected();
  const selectableMatching = matching.filter((id) => {
    const row = data.find((item) => getRowId(item) === id);
    return !row || !selection?.canSelect || selection.canSelect(row);
  });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <DataTable>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sortable = sortKeys.includes(header.column.id);
                const direction = sorting[0]?.id === header.column.id ? sorting[0].desc : null;
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.columnDef.meta?.fill && "w-full",
                      header.column.columnDef.meta?.nowrap && "whitespace-nowrap",
                      header.column.columnDef.meta?.numeric && "text-right",
                      header.column.columnDef.meta?.narrow && "w-10",
                      header.column.columnDef.meta?.width === "action" && "w-12",
                      header.column.columnDef.meta?.width === "sm" && "w-32",
                      header.column.columnDef.meta?.width === "md" && "w-36",
                      header.column.columnDef.meta?.width === "lg" && "w-56",
                      header.column.columnDef.meta?.from === "sm" && "hidden sm:table-cell",
                      header.column.columnDef.meta?.from === "md" && "hidden md:table-cell",
                      header.column.columnDef.meta?.from === "lg" && "hidden lg:table-cell",
                      header.column.columnDef.meta?.from === "xl" && "hidden xl:table-cell",
                    )}
                    aria-sort={
                      direction === null ? undefined : direction ? "descending" : "ascending"
                    }
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          sortBy(header.column.id, header.column.columnDef.meta?.descFirst ?? false)
                        }
                        className="-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <table.FlexRender header={header} />
                        {direction === null ? (
                          <ArrowUpDownIcon
                            aria-hidden="true"
                            className="size-3.5 text-muted-foreground"
                          />
                        ) : direction ? (
                          <ArrowDownIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    cell.column.columnDef.meta?.fill && "w-full max-w-0",
                    cell.column.columnDef.meta?.nowrap && "whitespace-nowrap",
                    cell.column.columnDef.meta?.numeric && "text-right",
                    cell.column.columnDef.meta?.narrow && "w-10",
                    cell.column.columnDef.meta?.width === "action" && "w-12",
                    cell.column.columnDef.meta?.width === "sm" && "w-32",
                    cell.column.columnDef.meta?.width === "md" && "w-36",
                    cell.column.columnDef.meta?.width === "lg" && "w-56",
                    cell.column.columnDef.meta?.from === "sm" && "hidden sm:table-cell",
                    cell.column.columnDef.meta?.from === "md" && "hidden md:table-cell",
                    cell.column.columnDef.meta?.from === "lg" && "hidden lg:table-cell",
                    cell.column.columnDef.meta?.from === "xl" && "hidden xl:table-cell",
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
          {data.length === 0 && empty && (
            <TableRow>
              <TableCell colSpan={table.getAllLeafColumns().length}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>

      {selection && selected.length > 0 && (
        <div
          role="region"
          aria-label={t("selection")}
          className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 self-center rounded-xl border bg-background px-4 py-2.5 shadow-lg"
        >
          <span className="text-sm font-medium tabular-nums">
            {t("selected", { count: selected.length })}
          </span>
          {wholePage && selectableMatching.length > selected.length && (
            <Button size="sm" prominence="tertiary" onClick={() => setPicked(selectableMatching)}>
              {t("selectMatching", { count: selectableMatching.length })}
            </Button>
          )}
          {selection.actions(selected, clear)}
          <Button size="sm" prominence="tertiary" onClick={clear}>
            {t("clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A column of a table whose cells arrive already drawn: its URL key, header and layout. */
type DataTableRowsColumn = {
  id: string;
  header: React.ReactNode;
  layout?: DataTableColumnMeta;
};

/** A row whose cells arrive already drawn, keyed by the id of their column. */
type DataTableRow = { id: string; cells: Record<string, React.ReactNode> };

/**
 * `DataTableView` for a Server Component: the page describes its columns in words and draws each
 * cell itself, since a function cannot cross from the server to the browser. Sorting is the same;
 * a table that selects rows defines its columns in a client component instead.
 */
function DataTableRows({
  columns,
  rows,
  ...props
}: Omit<DataTableViewProps<DataTableRow>, "columns" | "data" | "getRowId" | "selection"> & {
  columns: DataTableRowsColumn[];
  rows: DataTableRow[];
}) {
  const column = dataTableColumns<DataTableRow>();
  return (
    <DataTableView
      {...props}
      data={rows}
      getRowId={(row) => row.id}
      columns={column.columns(
        columns.map((entry) =>
          column.display({
            id: entry.id,
            header: () => entry.header,
            cell: ({ row }) => row.original.cells[entry.id],
            meta: entry.layout,
          }),
        ),
      )}
    />
  );
}

export {
  DataTableRows,
  DataTableView,
  dataTableColumns,
  type DataTableColumn,
  type DataTableRow,
  type DataTableRowsColumn,
};
