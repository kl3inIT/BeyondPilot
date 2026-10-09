import { describe, expect, it } from "vitest";

import type { ApplicationView } from "@/lib/api/generated";

import { draftOf } from "./apply-draft";

const view = { solutions: [] } as unknown as ApplicationView;
const account = { country: "VN", phone: "+84 912 345 678" };

describe("draftOf", () => {
  it("starts a first application from the country and the number of the account", () => {
    expect(draftOf(view, account).contact).toMatchObject(account);
    expect(draftOf(view, {}).contact).toMatchObject({ country: "", phone: "" });
  });

  it("keeps what an application already holds over the account", () => {
    const saved = {
      ...view,
      application: { contact: { country: "SG", phone: null }, answers: {} },
    } as unknown as ApplicationView;

    expect(draftOf(saved, account).contact).toMatchObject({
      country: "SG",
      phone: "+84 912 345 678",
    });
  });
});
