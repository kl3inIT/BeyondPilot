import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render";

import { UseCasesToolbar } from "./use-cases-toolbar";

describe("public use-case proposal status", () => {
  it("filters to closed proposals, resets the page and retains the other controls", async () => {
    const { user, onUrlUpdate } = render(<UseCasesToolbar count="Showing 1 of 2" />, {
      searchParams: "?q=claims&industry=insurance&sort=deadline&page=2&size=25",
    });

    await user.click(screen.getByRole("combobox", { name: "Proposals" }));
    await user.click(screen.getByRole("option", { name: "Closed" }));

    await waitFor(() => {
      const query = new URLSearchParams(onUrlUpdate.mock.lastCall?.[0].queryString);
      expect(query.get("proposalStatus")).toBe("closed");
      expect(query.has("page")).toBe(false);
      expect(query.get("q")).toBe("claims");
      expect(query.get("industry")).toBe("insurance");
      expect(query.get("sort")).toBe("deadline");
      expect(query.get("size")).toBe("25");
    });
  });

  it("clears availability and industry together without clearing the search or page size", async () => {
    const { user, onUrlUpdate } = render(<UseCasesToolbar count={null} />, {
      searchParams: "?q=claims&industry=insurance&proposalStatus=closed&page=2&size=25",
    });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      const query = new URLSearchParams(onUrlUpdate.mock.lastCall?.[0].queryString);
      expect(query.has("proposalStatus")).toBe(false);
      expect(query.has("industry")).toBe(false);
      expect(query.has("page")).toBe(false);
      expect(query.get("q")).toBe("claims");
      expect(query.get("size")).toBe("25");
    });
  });
});
