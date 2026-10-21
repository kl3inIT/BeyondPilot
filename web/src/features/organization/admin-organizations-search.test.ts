import { describe, expect, it } from "vitest";

import { loadAdminOrganizationsSearch } from "./admin-organizations-search";

describe("loadAdminOrganizationsSearch", () => {
  it("reads a status the list still filters by", () => {
    expect(loadAdminOrganizationsSearch("?status=claimed").status).toBe("claimed");
  });

  it("drops a status that no longer exists", () => {
    for (const retired of ["in_review", "needs_changes", "rejected"]) {
      expect(loadAdminOrganizationsSearch(`?status=${retired}`).status).toBeNull();
    }
  });
});
