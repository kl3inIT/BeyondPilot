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
  /** Shown from 1024px on: a column the table does without when narrower. */
  wide?: boolean;
  /** As narrow as a checkbox. */
  narrow?: boolean;
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

function sortOf(sorting: SortingState): string {
  const [first] = sorting;
  return first ? `${first.desc ? "-" : ""}${first.id}` : "";
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
  className,
}: DataTableViewProps<TData>) {
  const t = useTranslations("Lists.table");
  const [, startTransition] = useTransition();
  const [query, setQuery] = useQueryStates(
    { sort: parseAsString.withDefault(""), page: parseAsInteger },
    { shallow: false, startTransition },
  );
  const sorting = sortingOf(query.sort || defaultSort);
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
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = sortOf(functionalUpdate(updater, sorting));
      void setQuery({ sort: next === defaultSort ? null : next, page: null });
    },
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
                      header.column.columnDef.meta?.wide && "hidden lg:table-cell",
                      header.column.columnDef.meta?.narrow && "w-10",
                    )}
                    aria-sort={
                      direction === null ? undefined : direction ? "descending" : "ascending"
                    }
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
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
                    cell.column.columnDef.meta?.wide && "hidden lg:table-cell",
                    cell.column.columnDef.meta?.narrow && "w-10",
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
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

export { DataTableView, dataTableColumns, type DataTableColumn };
