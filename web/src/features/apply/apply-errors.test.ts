import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import { refusedFields } from "./apply-errors";

function refusal(...pointers: string[]) {
  return new ApiError(400, {
    status: 400,
    code: "REQUEST_INVALID",
    errors: pointers.map((pointer) => ({ pointer, detail: "size must be between 0 and 600" })),
  } as ConstructorParameters<typeof ApiError>[1]);
}

describe("refusedFields", () => {
  it("names the field and the step of each member the application's save refused, in step order", () => {
    expect(
      refusedFields(
        refusal("#/answers/q-1", "#/traction", "#/builtWith/3", "#/contact/phone"),
        "application",
      ),
    ).toEqual([
      { name: "application.contact.phone", step: "you" },
      { name: "application.traction", step: "solution" },
      { name: "application.builtWith", step: "solution" },
      { name: "application.answers.q-1", step: "questions" },
    ]);
  });

  it("names the solution's fields the form holds, and none for a part written elsewhere", () => {
    expect(refusedFields(refusal("#/summary", "#/valueProposition"), "solution")).toEqual([
      { name: "solution.summary", step: "solution" },
    ]);
  });

  it("names nothing for a failure that is not a refusal of fields", () => {
    expect(refusedFields(new Error("offline"), "application")).toEqual([]);
  });
});
