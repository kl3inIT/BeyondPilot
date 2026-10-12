import { describe, expect, it } from "vitest";

import { ApiError } from "./client";
import { rejectedFields } from "./rejected-fields";

function problem(...pointers: string[]) {
  return new ApiError(400, {
    status: 400,
    title: "Invalid",
    requestId: "r",
    errors: pointers.map((pointer) => ({ pointer, code: "invalid", detail: "" })),
  });
}

describe("rejectedFields", () => {
  it("names the field of each pointer once, whatever lies under it", () => {
    expect(rejectedFields(problem("#/name", "#/roles/0", "#/roles/1", "/website"))).toEqual(
      new Set(["name", "roles", "website"]),
    );
  });

  it("looks under the member that holds the form's fields, when told which", () => {
    expect(
      rejectedFields(problem("#/profile/name", "#/emailDomain", "#/profile"), "profile"),
    ).toEqual(new Set(["name", "emailDomain"]));
  });

  it("is empty for a failure that is not a validation problem", () => {
    expect(rejectedFields(new ApiError(undefined, undefined))).toEqual(new Set());
    expect(rejectedFields(new Error("other"))).toEqual(new Set());
    expect(rejectedFields(problem("#/"))).toEqual(new Set());
  });
});
