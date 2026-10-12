import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { TableScroll } from "./table-scroll";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A screen with sizes, which jsdom has none of: every element is `frame` wide and holds `table` of
 * content, and the observer reports as a browser's does, once when it starts and at each `resize`.
 */
function layout(sizes: { frame: number; table: number }) {
  const frame = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(sizes.frame);
  const table = vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(sizes.table);
  const reports = new Set<() => void>();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly report: () => void;
      constructor(report: () => void) {
        this.report = report;
      }
      observe() {
        reports.add(this.report);
        this.report();
      }
      unobserve() {}
      disconnect() {
        reports.delete(this.report);
      }
    },
  );
  return {
    resize(next: { frame: number; table: number }) {
      frame.mockReturnValue(next.frame);
      table.mockReturnValue(next.table);
      act(() => reports.forEach((report) => report()));
    },
  };
}

function table(label?: string) {
  return (
    <TableScroll label={label}>
      <table>
        <tbody>
          <tr>
            <td>Plain Cover</td>
          </tr>
        </tbody>
      </table>
    </TableScroll>
  );
}

describe("TableScroll", () => {
  it("is a plain frame the keyboard passes while the table fits", async () => {
    layout({ frame: 800, table: 800 });
    const { user } = render(table("Applications"));

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await user.tab();
    expect(document.body).toHaveFocus();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("is a region named after the table, which the keyboard reaches, while the table overflows", async () => {
    layout({ frame: 360, table: 800 });
    const { user } = render(table("Applications"));

    const region = screen.getByRole("region", { name: "Applications" });
    await user.tab();
    expect(region).toHaveFocus();
  });

  it("says it is a table that scrolls when the table has no name", () => {
    layout({ frame: 360, table: 800 });
    render(table());

    expect(screen.getByRole("region", { name: "Table, scrolls sideways" })).toBeInTheDocument();
  });

  it("follows the screen as it narrows and widens", () => {
    const screenSize = layout({ frame: 800, table: 800 });
    render(table("Applications"));

    screenSize.resize({ frame: 360, table: 800 });
    expect(screen.getByRole("region", { name: "Applications" })).toBeInTheDocument();

    screenSize.resize({ frame: 800, table: 800 });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays a region at the end of the scroll, where only the start is hidden", () => {
    layout({ frame: 360, table: 800 });
    render(table("Applications"));
    const region = screen.getByRole("region", { name: "Applications" });

    fireEvent.scroll(region, { target: { scrollLeft: 440 } });

    expect(screen.getByRole("region", { name: "Applications" })).toBe(region);
  });
});
