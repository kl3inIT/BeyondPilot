import { describe, expect, it } from "vitest";

import type { Me } from "@/lib/api/generated";

import { contactBodyOf, contactSchema, contactValuesOf, MAX_NAME } from "./identity-schemas";

const schema = contactSchema((key) => key);

/** The fields a contact is refused at, each with what it says. */
function refusedAt(values: { name: string; country: string; phone: string }) {
  const result = schema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

describe("contactSchema", () => {
  it("takes a name alone, the country and the number left empty", () => {
    expect(refusedAt({ name: "Đạt Phan", country: "", phone: "" })).toEqual({});
  });

  it("asks for the name, and takes one that is only spaces as none", () => {
    expect(refusedAt({ name: "", country: "VN", phone: "" })).toEqual({ name: "nameRequired" });
    expect(refusedAt({ name: "  ", country: "VN", phone: "" })).toEqual({ name: "nameRequired" });
  });

  it("takes a name up to the backend's limit", () => {
    expect(refusedAt({ name: "a".repeat(MAX_NAME), country: "", phone: "" })).toEqual({});
    expect(refusedAt({ name: "a".repeat(MAX_NAME + 1), country: "", phone: "" })).toHaveProperty(
      "name",
    );
  });

  it("refuses a number written in letters", () => {
    expect(refusedAt({ name: "Đạt Phan", country: "", phone: "call me" })).toEqual({
      phone: "phoneInvalid",
    });
    expect(refusedAt({ name: "Đạt Phan", country: "", phone: " +84 (912) 345-678 " })).toEqual({});
  });
});

describe("contactValuesOf and contactBodyOf", () => {
  it("holds an account without a name, a country or a number as empty fields", () => {
    expect(contactValuesOf({ email: "an@example.com" } as Me)).toEqual({
      name: "",
      country: "",
      phone: "",
    });
  });

  it("sends the name trimmed, and an empty country or number as none", () => {
    expect(contactBodyOf({ name: " Đạt Phan ", country: "", phone: "  " })).toEqual({
      name: "Đạt Phan",
      country: null,
      phone: null,
    });
    expect(contactBodyOf({ name: "Đạt Phan", country: "VN", phone: " +84 912 345 678 " })).toEqual({
      name: "Đạt Phan",
      country: "VN",
      phone: "+84 912 345 678",
    });
  });
});
