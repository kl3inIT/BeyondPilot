import { describe, expect, expectTypeOf, it } from "vitest";

import type { AuditEvent } from "@/lib/api/generated";

import { auditActionGroups, auditActions, type AuditAction } from "./audit-log-search";

describe("auditActions", () => {
  it("is the backend's catalog, every action and nothing else, so the filter misses none", () => {
    // Checked when the code is compiled: an action the backend adds and the list lacks fails here.
    expectTypeOf<AuditAction>().toEqualTypeOf<AuditEvent["action"]>();
  });
});

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
