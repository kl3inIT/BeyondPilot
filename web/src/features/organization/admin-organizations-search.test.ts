import { describe, expect, it } from "vitest";

import { knownSort } from "@/lib/list-sort";

import {
  adminOrganizationSortKeys,
  loadAdminOrganizationsSearch,
} from "./admin-organizations-search";

describe("loadAdminOrganizationsSearch", () => {
  it("reads a status the list still filters by", () => {
    expect(loadAdminOrganizationsSearch("?status=active").status).toBe("active");
    expect(loadAdminOrganizationsSearch("?status=claimed").status).toBe("claimed");
  });

  it("sends the sort keys the API takes and drops an old ?sort=received bookmark", () => {
    const sortOf = (query: string) =>
      knownSort(loadAdminOrganizationsSearch(query).sort, adminOrganizationSortKeys);
    expect(sortOf("?sort=created")).toBe("created");
    expect(sortOf("?sort=-created")).toBe("-created");
    expect(sortOf("?sort=received")).toBeUndefined();
    expect(sortOf("?sort=-received")).toBeUndefined();
  });

  it("drops a status that no longer exists, an old ?status=approved bookmark among them", () => {
    for (const retired of ["approved", "in_review", "needs_changes", "rejected"]) {
      expect(loadAdminOrganizationsSearch(`?status=${retired}`).status).toBeNull();
    }
  });
});
