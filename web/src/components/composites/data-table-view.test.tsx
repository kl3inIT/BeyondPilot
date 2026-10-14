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
  describe("row links", () => {
    function linked(onOpen: (href: string) => void) {
      return (
        <DataTableRows
          rowLinks
          columns={[
            { id: "name", header: "Solution" },
            { id: "score", header: "Score" },
          ]}
          rows={solutions.map((solution) => ({
            id: solution.id,
            cells: {
              name: (
                <a
                  href={`/solutions/${solution.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(`/solutions/${solution.id}`);
                  }}
                >
                  {solution.name}
                </a>
              ),
              score: solution.score,
            },
          }))}
        />
      );
    }

    it("follows the link of the row pressed, wherever on the row", async () => {
      const opened: string[] = [];
      const { user } = render(linked((href) => opened.push(href)));

      await user.click(screen.getByRole("cell", { name: "64" }));
      await user.click(screen.getByRole("cell", { name: "71" }));
      await user.click(screen.getByRole("link", { name: "Field Notes" }));

      expect(opened).toEqual(["/solutions/s2", "/solutions/s1", "/solutions/s3"]);
    });
  });

  describe("sorting", () => {
    it("writes the column to ?sort= and returns to the first page", async () => {
      const { user, onUrlUpdate } = render(sorted(), { searchParams: "?page=3" });

      await user.click(screen.getByRole("button", { name: "Solution" }));

      await waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=name"));
    });

    it("turns the order round on the second click", async () => {
      const { user, onUrlUpdate } = render(sorted());

      await user.click(screen.getByRole("button", { name: "Solution" }));
      // The URL is written a moment after the click, and the header follows the URL.
      await waitFor(() =>
        expect(screen.getByRole("columnheader", { name: "Solution" })).toHaveAttribute(
          "aria-sort",
          "ascending",
        ),
      );
      await user.click(screen.getByRole("button", { name: "Solution" }));

      await waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=-name"));
      await waitFor(() =>
        expect(screen.getByRole("columnheader", { name: "Solution" })).toHaveAttribute(
          "aria-sort",
          "descending",
        ),
      );
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
      await waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?sort=score"));

      await user.click(screen.getByRole("button", { name: "Score" }));
      await waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(""));
    });

    it("sorts a column of scores from the highest on its first click", async () => {
      const { user, onUrlUpdate } = render(sorted(), { searchParams: "?sort=name" });

      await user.click(screen.getByRole("button", { name: "Score" }));

      await waitFor(() => expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(""));
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
