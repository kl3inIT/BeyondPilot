import { describe, expect, it } from "vitest";

import type { ApplicationView } from "@/lib/api/generated";

import { draftOf, invalidContact, savable, saveBodyOf } from "./apply-draft";

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

// Drafts as the backend stored them before the form moved onto one form hook, and older ones still.
describe("draftOf, for a draft stored earlier", () => {
  const stored = (application: Record<string, unknown>, more: Record<string, unknown> = {}) =>
    ({ solutions: [], ...more, application }) as unknown as ApplicationView;

  it("reads a draft that lacks members as empty fields", () => {
    expect(draftOf(stored({ answers: {} }), {})).toEqual({
      contact: { firstName: "", lastName: "", phone: "", country: "", linkedin: "" },
      teamBackground: "",
      solutionId: null,
      deck: null,
      builtWith: [],
      traction: "",
      answers: {},
    });
    // A contact saved with nothing in it, as an empty save answers it.
    expect(
      draftOf(stored({ contact: { firstName: null, lastName: null }, teamBackground: null }), {}),
    ).toMatchObject({
      contact: { firstName: "", lastName: "", phone: "", country: "", linkedin: "" },
      teamBackground: "",
      answers: {},
    });
  });

  it("leaves out members the form does not hold", () => {
    const draft = draftOf(
      stored({
        id: "3e2d1c0b-0000-4000-8000-000000000030",
        status: "submitted",
        submissions: 2,
        version: 7,
        files: {},
        contact: { firstName: "An", lastName: "Tran", title: "CTO" },
        answers: {},
      }),
      {},
    );

    expect(Object.keys(draft).sort()).toEqual([
      "answers",
      "builtWith",
      "contact",
      "deck",
      "solutionId",
      "teamBackground",
      "traction",
    ]);
    expect(Object.keys(draft.contact).sort()).toEqual([
      "country",
      "firstName",
      "lastName",
      "linkedin",
      "phone",
    ]);
  });

  it("keeps an answer to a question that is gone, and one whose option is gone, as stored", () => {
    const answers = {
      "7c1e0a2b-0000-4000-8000-0000000000aa": "An answer to a question since removed",
      "7c1e0a2b-0000-4000-8000-000000000001": "A direction no longer offered",
      "7c1e0a2b-0000-4000-8000-000000000005": '["Claims","An area no longer offered"]',
    };
    const draft = draftOf(stored({ answers }), {});

    expect(draft.answers).toEqual(answers);
    // And a save sends them back as they were.
    expect(saveBodyOf(draft, 4).answers).toEqual(answers);
  });

  it("takes the solution, the deck and the lists of the stored application", () => {
    const deck = {
      fileId: "9d8c7b6a-0000-4000-8000-000000000041",
      fileName: "deck.pdf",
      sizeBytes: 1,
    };
    const draft = draftOf(
      stored(
        {
          solutionId: "5a0b7c1d-0000-4000-8000-000000000010",
          deck,
          builtWith: ["OpenAI GPT"],
          traction: "Two pilots.",
          answers: {},
        },
        // Two solutions, so none is chosen for the person: the stored one stays.
        { solutions: [{ id: "a" }, { id: "b" }] },
      ),
      {},
    );

    expect(draft).toMatchObject({
      solutionId: "5a0b7c1d-0000-4000-8000-000000000010",
      deck,
      builtWith: ["OpenAI GPT"],
      traction: "Two pilots.",
    });
  });
});

describe("saveBodyOf", () => {
  it("sends empty text as nothing and leaves an empty answer out", () => {
    const draft = draftOf({ solutions: [] } as unknown as ApplicationView, {});

    expect(
      saveBodyOf(
        {
          ...draft,
          contact: { ...draft.contact, firstName: " An ", phone: "  " },
          answers: { one: "Claiming", two: "", three: "  " },
        },
        null,
      ),
    ).toEqual({
      contact: { firstName: "An", lastName: null, phone: null, country: null, linkedin: null },
      teamBackground: null,
      solutionId: null,
      deckFileId: null,
      builtWith: [],
      traction: null,
      answers: { one: "Claiming" },
      version: null,
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
