import { describe, expect, it } from "vitest";

import type { ApplicationView } from "@/lib/api/generated";

import { draftOf, invalidContact, savable } from "./apply-draft";

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

describe("invalidContact", () => {
  const typed = (phone: string, linkedin: string) => {
    const draft = draftOf(view, {});
    return { ...draft, contact: { ...draft.contact, phone, linkedin } };
  };

  it("accepts what the backend accepts, and an empty field", () => {
    expect(invalidContact(typed("+84 912 345 678", "https://www.linkedin.com/in/antran"))).toEqual(
      [],
    );
    expect(invalidContact(typed("(028) 3822-1234", ""))).toEqual([]);
    expect(invalidContact(typed("", ""))).toEqual([]);
  });

  it("names a number with letters and an address without https", () => {
    expect(invalidContact(typed("abc", "www.linkedin.com/in/antran"))).toEqual([
      "phone",
      "linkedin",
    ]);
  });

  it("leaves a refused field out of what is saved while typing, and keeps the rest", () => {
    const draft = typed("abc", "https://www.linkedin.com/in/antran");
    expect(savable(draft).contact).toMatchObject({
      phone: "",
      linkedin: "https://www.linkedin.com/in/antran",
    });
    expect(draft.contact.phone).toBe("abc");
    const sound = typed("+84 912 345 678", "");
    expect(savable(sound)).toBe(sound);
  });
});
