import { describe, expect, expectTypeOf, it } from "vitest";

import type { AuditEvent } from "@/lib/api/generated";

import {
  actionsMatching,
  auditActionGroups,
  auditActions,
  type AuditAction,
} from "./audit-log-search";

describe("auditActions", () => {
  it("is the backend's catalog, every action and nothing else, so the filter misses none", () => {
    // Checked when the code is compiled: an action the backend adds and the list lacks fails here.
    // Both ways rather than toEqualTypeOf, which past about 140 actions judges equal unions unequal.
    expectTypeOf<AuditAction>().toExtend<AuditEvent["action"]>();
    expectTypeOf<AuditEvent["action"]>().toExtend<AuditAction>();
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

describe("actionsMatching", () => {
  const names = (action: AuditAction) =>
    action === "audit.export"
      ? ["Downloaded the audit log", "Downloaded the audit log"]
      : action === "account.export"
        ? ["Downloaded the accounts", "Downloaded the accounts"]
        : ["Something else"];

  it("finds the actions whose names hold the words, ignoring case", () => {
    expect(actionsMatching("  downloaded THE ", names)).toEqual(["account.export", "audit.export"]);
    expect(actionsMatching("audit log", names)).toEqual(["audit.export"]);
  });

  it("names none for an empty search or words no name holds", () => {
    expect(actionsMatching("   ", names)).toEqual([]);
    expect(actionsMatching("mina@audit.test", names)).toEqual([]);
  });
});
