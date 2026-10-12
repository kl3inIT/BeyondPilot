import { describe, expect, it } from "vitest";

import { auditActionGroups, auditActions } from "./audit-log-search";

describe("auditActionGroups", () => {
  it("files every action under one area, so the filter offers each of them once", () => {
    const grouped = auditActionGroups.flatMap((group) => group.actions);

    expect([...grouped].sort()).toEqual([...auditActions].sort());
  });

  it("has no area without an action", () => {
    expect(auditActionGroups.filter((group) => group.actions.length === 0)).toEqual([]);
  });

  it("files an operator's role with the accounts and a judging action with the programs", () => {
    const areaOf = (action: string) =>
      auditActionGroups.find((group) => (group.actions as string[]).includes(action))?.area;

    expect(areaOf("operator.grant")).toBe("accounts");
    expect(areaOf("proposal.reviewer_invite")).toBe("programs");
  });
});
