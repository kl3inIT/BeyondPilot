import { describe, expect, it } from "vitest";

import type { Organization } from "@/lib/api/generated";

import {
  profileBodyOf,
  profileSchema,
  profileValuesOf,
  type ProfileValues,
} from "./organization-schemas";

const schema = profileSchema((key) => key);

const filled: ProfileValues = {
  name: "Sài Gòn Logistics",
  website: "https://saigonlogistics.example",
  type: "company",
  teamSize: "2_9",
  industries: ["logistics"],
  country: "VN",
  foundedYear: "2019",
  description: "Route planning for fleets.",
  logoFileId: "",
};

/** The fields a profile is refused at, each with what it says. */
function refusedAt(values: ProfileValues) {
  const result = schema.safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

describe("profileSchema", () => {
  it("takes a profile with every fact", () => {
    expect(refusedAt(filled)).toEqual({});
  });

  it("asks for every fact of an empty company, each in its own words", () => {
    expect(refusedAt(profileValuesOf())).toEqual({
      name: "nameRequired",
      website: "websiteRequired",
      teamSize: "teamSizeRequired",
      industries: "industriesRequired",
      country: "countryRequired",
      foundedYear: "foundedYearInvalid",
      description: "descriptionRequired",
    });
  });

  it("takes text that is only spaces as nothing", () => {
    expect(refusedAt({ ...filled, name: "  ", website: " ", description: "\n" })).toEqual({
      name: "nameRequired",
      website: "websiteRequired",
      description: "descriptionRequired",
    });
  });

  it("asks only a company for its industries", () => {
    expect(refusedAt({ ...filled, industries: [] })).toEqual({ industries: "industriesRequired" });
    expect(refusedAt({ ...filled, type: "independent_builder", industries: [] })).toEqual({});
    expect(refusedAt({ ...filled, type: "builder_team", industries: [] })).toEqual({});
  });

  it("leaves the form of the website to the backend", () => {
    expect(refusedAt({ ...filled, website: "saigonlogistics.example" })).toEqual({});
  });

  it("takes a four-digit year up to this one", () => {
    expect(refusedAt({ ...filled, foundedYear: "20x9" })).toEqual({
      foundedYear: "foundedYearInvalid",
    });
    expect(refusedAt({ ...filled, foundedYear: "1799" })).toEqual({
      foundedYear: "foundedYearInvalid",
    });
    expect(refusedAt({ ...filled, foundedYear: "9999" })).toEqual({
      foundedYear: "foundedYearInvalid",
    });
  });
});

describe("profileValuesOf and profileBodyOf", () => {
  const organization = {
    name: "Pocket Policy",
    type: "company",
    country: "SG",
    teamSize: "10_49",
    industries: ["insurance"],
    website: "https://pocketpolicy.example",
    description: "Assistants for insurers across Southeast Asia.",
    foundedYear: 2021,
    logoFileId: null,
  } as Organization;

  it("holds a saved profile as text and sends it back as it was", () => {
    const values = profileValuesOf(organization);
    expect(values).toMatchObject({ foundedYear: "2021", logoFileId: "" });
    expect(profileBodyOf(values)).toEqual({
      name: "Pocket Policy",
      type: "company",
      country: "SG",
      teamSize: "10_49",
      industries: ["insurance"],
      website: "https://pocketpolicy.example",
      description: "Assistants for insurers across Southeast Asia.",
      foundedYear: 2021,
      logoFileId: null,
    });
  });

  it("holds what an organization created by an operator lacks as empty fields", () => {
    expect(
      profileValuesOf({
        name: "Mekong AI",
        type: "builder_team",
        industries: [],
      } as unknown as Organization),
    ).toEqual({
      name: "Mekong AI",
      website: "",
      type: "builder_team",
      teamSize: "",
      industries: [],
      country: "",
      foundedYear: "",
      description: "",
      logoFileId: "",
    });
  });

  it("trims the name, the website and the description", () => {
    expect(
      profileBodyOf({
        ...filled,
        name: " Sài Gòn ",
        website: " https://a.example ",
        description: " Routes. ",
      }),
    ).toMatchObject({ name: "Sài Gòn", website: "https://a.example", description: "Routes." });
  });
});
