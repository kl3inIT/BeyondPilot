import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render";

import { DataTableRows, DataTableView, dataTableColumns } from "./data-table-view";

type Solution = { id: string; name: string; score: number; locked?: boolean };

const solutions: Solution[] = [
  { id: "s1", name: "Plain Cover", score: 71 },
  { id: "s2", name: "Claims Desk", score: 64 },
  { id: "s3", name: "Field Notes", score: 58, locked: true },
];

const column = dataTableColumns<Solution>();
const columns = column.columns([
  column.accessor("name", { header: "Solution", cell: ({ getValue }) => getValue() }),
  column.accessor("score", {
    header: "Score",
    meta: { descFirst: true },
    cell: ({ getValue }) => getValue(),
  }),
]);

/**
 * Waits until a column says which way it is sorted. A click writes the order to the URL in a
 * transition, so the header follows a moment later, and the next click turns round whatever order
 * the header shows by then.
 */
function sortedAs(name: string, order: "ascending" | "descending") {
  return waitFor(() =>
    expect(screen.getByRole("columnheader", { name })).toHaveAttribute("aria-sort", order),
  );
}

/** A list that sorts by both columns; the server's order is the highest score first. */
function sorted() {
  return (
    <DataTableView
      columns={columns}
      data={solutions}
      getRowId={(row) => row.id}
      sortKeys={["name", "score"]}
      defaultSort="-score"
    />
  );
}

/** A list whose rows are selected, except the locked one. */
function selectable(data = solutions) {
  return (
    <DataTableView
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      selection={{
        name: (row) => row.name,
        canSelect: (row) => !row.locked,
        actions: (ids) => <output aria-label="Chosen">{ids.join(" ")}</output>,
      }}
    />
  );
}

describe("DataTableView", () => {
  describe("sorting", () => {
    it("writes the column to ?sort= and returns to the first page", async () => {
      const { user, onUrlUpdate } = render(sorted(), { searchParams: "?page=3" });

      await user.click(screen.getByRole("button", { name: "Solution" }));

      expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=name");
    });

    it("turns the order round on the second click", async () => {
      const { user, onUrlUpdate } = render(sorted());

      await user.click(screen.getByRole("button", { name: "Solution" }));
      await sortedAs("Solution", "ascending");
      await user.click(screen.getByRole("button", { name: "Solution" }));

      await sortedAs("Solution", "descending");
      expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=-name");
    });

    it("reads the order from the URL", () => {
      render(sorted(), { searchParams: "?sort=name" });

      expect(screen.getByRole("columnheader", { name: "Solution" })).toHaveAttribute(
        "aria-sort",
        "ascending",
      );
      expect(screen.getByRole("columnheader", { name: "Score" })).not.toHaveAttribute("aria-sort");
    });

    it("shows the server's own order when the URL names none, and keeps it out of the URL", async () => {
      const { user, onUrlUpdate } = render(sorted(), { searchParams: "?page=2" });
      expect(screen.getByRole("columnheader", { name: "Score" })).toHaveAttribute(
        "aria-sort",
        "descending",
      );

      await user.click(screen.getByRole("button", { name: "Score" }));
      await sortedAs("Score", "ascending");
      expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=score");

      await user.click(screen.getByRole("button", { name: "Score" }));
      await sortedAs("Score", "descending");
      expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("");
    });

    it("sorts a column of scores from the highest on its first click", async () => {
      const { user, onUrlUpdate } = render(sorted(), { searchParams: "?sort=name" });

      await user.click(screen.getByRole("button", { name: "Score" }));

      expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("");
    });

    it("offers no sorting on a column the server does not sort by", () => {
      render(
        <DataTableRows
          columns={[
            { id: "name", header: "Solution" },
            { id: "owner", header: "Owner" },
          ]}
          rows={[{ id: "s1", cells: { name: "Plain Cover", owner: "Lan" } }]}
          sortKeys={["name"]}
        />,
      );

      expect(screen.getByRole("button", { name: "Solution" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Owner" })).not.toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "Lan" })).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("shows the selected rows in a bar with their count and their actions", async () => {
      const { user } = render(selectable());
      expect(screen.queryByRole("region", { name: "Selected rows" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: "Select Plain Cover" }));
      const bar = within(screen.getByRole("region", { name: "Selected rows" }));
      expect(bar.getByText("1 selected")).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: "Select Claims Desk" }));
      expect(bar.getByText("2 selected")).toBeInTheDocument();
      expect(bar.getByRole("status", { name: "Chosen" })).toHaveTextContent("s1 s2");
    });

    it("empties the selection on Escape", async () => {
      const { user } = render(selectable());
      await user.click(screen.getByRole("checkbox", { name: "Select Plain Cover" }));

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("region", { name: "Selected rows" })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Select Plain Cover" })).not.toBeChecked();
    });

    it("empties the selection from the bar", async () => {
      const { user } = render(selectable());
      await user.click(screen.getByRole("checkbox", { name: "Select Plain Cover" }));

      await user.click(screen.getByRole("button", { name: "Clear selection" }));

      expect(screen.queryByRole("region", { name: "Selected rows" })).not.toBeInTheDocument();
    });

    it("selects every row of the page that may be selected", async () => {
      const { user } = render(selectable());

      await user.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));

      expect(screen.getByText("2 selected")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Select Field Notes" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.getByRole("checkbox", { name: "Select Field Notes" })).not.toBeChecked();
    });

    it("drops a row from the selection when it leaves the list", async () => {
      const { user, rerender } = render(selectable());
      await user.click(screen.getByRole("checkbox", { name: "Select Plain Cover" }));
      await user.click(screen.getByRole("checkbox", { name: "Select Claims Desk" }));

      rerender(selectable(solutions.slice(1)));

      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });
  });
});
