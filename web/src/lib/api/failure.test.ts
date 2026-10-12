import { describe, expect, it } from "vitest";

import type { MessageKey } from "@/hooks/use-notify";

import { codesOf, problemsOf } from "../../../scripts/check-error-codes.mjs";
import { ApiError } from "./client";
import { failedWith, failureKey } from "./failure";

function refusal(code: string, pointers: string[] = []) {
  return new ApiError(409, {
    status: 409,
    title: "Refused",
    requestId: "r",
    code,
    errors: pointers.map((pointer) => ({ pointer, code: "invalid", detail: "" })),
  });
}

/** A catalog that holds exactly these messages. */
const holding =
  (...keys: string[]) =>
  (key: MessageKey) =>
    keys.includes(key);

describe("failureKey", () => {
  it("gives the words of the code when the catalog has them", () => {
    expect(
      failureKey(refusal("ORGANIZATION_DOMAIN_TAKEN"), holding("Errors.ORGANIZATION_DOMAIN_TAKEN")),
    ).toBe("Errors.ORGANIZATION_DOMAIN_TAKEN");
  });

  it("falls back to the general words for a code the catalog does not hold", () => {
    expect(failureKey(refusal("SOMETHING_NEW"), holding())).toBe("Errors.unknown");
  });

  it("falls back to what the screen says did not happen, when it says so", () => {
    expect(failureKey(refusal("SOMETHING_NEW"), holding(), { otherwise: "Account.failed" })).toBe(
      "Account.failed",
    );
  });

  it("prefers the screen's own words for a code to the general ones", () => {
    expect(
      failureKey(refusal("PROPOSAL_CLOSED"), holding("Errors.PROPOSAL_CLOSED"), {
        PROPOSAL_CLOSED: "Application.withdraw.closed",
        otherwise: "Application.withdraw.failed",
      }),
    ).toBe("Application.withdraw.closed");
  });

  it("never reads `otherwise` as the words of a code", () => {
    expect(failureKey(refusal("otherwise"), holding(), { otherwise: "Account.failed" })).toBe(
      "Account.failed",
    );
    expect(failureKey(refusal("constructor"), holding())).toBe("Errors.unknown");
  });

  it("says a request with rejected fields in the words of its code", () => {
    expect(
      failureKey(refusal("REQUEST_INVALID", ["#/name"]), holding("Errors.REQUEST_INVALID")),
    ).toBe("Errors.REQUEST_INVALID");
  });

  it("gives the fallback for a request that got no answer and for another kind of failure", () => {
    const all = () => true;
    expect(failureKey(new ApiError(undefined, undefined), all)).toBe("Errors.unknown");
    expect(failureKey(new ApiError(502, undefined), all)).toBe("Errors.unknown");
    expect(failureKey(new Error("other"), all, { otherwise: "Account.failed" })).toBe(
      "Account.failed",
    );
    expect(failureKey(undefined, all)).toBe("Errors.unknown");
  });
});

describe("failedWith", () => {
  it("names the code the request was refused with, among those asked about", () => {
    const error = refusal("ORGANIZATION_DOMAIN_TAKEN");
    expect(failedWith(error, "REQUEST_INVALID", "ORGANIZATION_DOMAIN_TAKEN")).toBe(
      "ORGANIZATION_DOMAIN_TAKEN",
    );
    expect(failedWith(error, "REQUEST_INVALID")).toBeUndefined();
    expect(failedWith(new Error("other"), "REQUEST_INVALID")).toBeUndefined();
  });
});

describe("the failure code check", () => {
  const java = `
public enum StorageErrorCode implements ErrorCode {

	FILE_TOO_LARGE("STORAGE_FILE_TOO_LARGE", ErrorCategory.VALIDATION, "This file is larger than the limit."),

	TICKET_EXPIRED(
			"STORAGE_TICKET_EXPIRED", ErrorCategory.GONE,
			"This upload took too long. Start it again.");

	private final String code;
}`;

  it("reads the wire code of each constant, not its name", () => {
    expect(codesOf(java)).toEqual(["STORAGE_FILE_TOO_LARGE", "STORAGE_TICKET_EXPIRED"]);
  });

  const check = (worded: string[], listed: string[]) =>
    problemsOf({ codes: codesOf(java), worded, listed, catalog: "messages/en.json" });

  it("passes when every code is worded or listed as general", () => {
    expect(check(["STORAGE_FILE_TOO_LARGE"], ["STORAGE_TICKET_EXPIRED"])).toEqual([]);
  });

  it("fails on a code with neither words nor a place in the general list", () => {
    expect(check(["STORAGE_FILE_TOO_LARGE"], [])).toEqual([
      expect.stringContaining("STORAGE_TICKET_EXPIRED has no words"),
    ]);
  });

  it("fails on words, and on a general entry, for a code the backend does not raise", () => {
    expect(
      check(["STORAGE_FILE_TOO_LARGE", "STORAGE_TICKET_EXPIRED", "STORAGE_GONE"], ["STORAGE_OLD"]),
    ).toEqual([
      expect.stringContaining("Errors.STORAGE_GONE, which the backend does not raise"),
      expect.stringContaining("STORAGE_OLD is listed as general"),
    ]);
  });

  it("fails on a code that is both worded and listed as general", () => {
    expect(
      check(["STORAGE_FILE_TOO_LARGE", "STORAGE_TICKET_EXPIRED"], ["STORAGE_TICKET_EXPIRED"]),
    ).toEqual([expect.stringContaining("keep one")]);
  });
});
