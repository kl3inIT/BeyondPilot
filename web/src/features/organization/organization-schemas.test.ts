import { describe, expect, it } from "vitest";

import type { Organization } from "@/lib/api/generated";

import {
  aloneBodyOf,
  basicsSchema,
  creationSchema,
  missingProfileFacts,
  profileBodyOf,
  profileSchema,
  profileValuesOf,
  type ProfileValues,
} from "./organization-schemas";

const schema = profileSchema((key) => key);

describe("organization basics", () => {
  const basics = basicsSchema((key) => key);
  const team = {
    name: "Doc Team",
    type: "builder_team",
    teamSize: "2_9",
    industries: [],
    country: "VN",
    teamBackground: "Built document assistants.",
  };
  it("requires team experience but not company-only industries", () => {
    expect(basics.safeParse(team).success).toBe(true);
    const empty = basics.safeParse({ ...team, teamBackground: " " });
    expect(empty.error?.issues.map((issue) => issue.path)).toEqual([["teamBackground"]]);
    expect(
      basics.safeParse({ ...team, type: "independent_builder", teamBackground: "" }).success,
    ).toBe(true);
    expect(
      basics.safeParse({ ...team, type: "company", industries: ["insurance"], teamBackground: "" })
        .success,
    ).toBe(true);
  });
  it("enforces the 2,000-character experience limit", () => {
    expect(basics.safeParse({ ...team, teamBackground: "x".repeat(2000) }).success).toBe(true);
    expect(basics.safeParse({ ...team, teamBackground: "x".repeat(2001) }).success).toBe(false);
  });
});

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
  teamBackground: "Built two products.",
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

  it("asks only a company for its website, its industries and the year it started", () => {
    const without = { ...filled, website: " ", industries: [], foundedYear: "" };
    expect(refusedAt(without)).toEqual({
      website: "websiteRequired",
      industries: "industriesRequired",
      foundedYear: "foundedYearInvalid",
    });
    expect(refusedAt({ ...without, type: "independent_builder" })).toEqual({});
    expect(refusedAt({ ...without, type: "builder_team" })).toEqual({});
  });

  it("checks a year a builder did write", () => {
    expect(refusedAt({ ...filled, type: "independent_builder", foundedYear: "20x9" })).toEqual({
      foundedYear: "foundedYearInvalid",
    });
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
      teamBackground: null,
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
      teamBackground: "",
      logoFileId: "",
    });
  });

  it("sends a website and a year left empty as none", () => {
    expect(
      profileBodyOf({ ...filled, type: "independent_builder", website: " ", foundedYear: "" }),
    ).toMatchObject({ website: null, foundedYear: null });
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

describe("missingProfileFacts", () => {
  const company = {
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

  it("finds nothing missing in a profile with every fact", () => {
    expect(missingProfileFacts(company)).toEqual([]);
  });

  it("names what a company lacks, in the order of the form", () => {
    expect(
      missingProfileFacts({
        ...company,
        description: " ",
        foundedYear: null,
        industries: [],
        website: null,
      }),
    ).toEqual(["website", "industries", "foundedYear", "description"]);
  });

  it("does not ask a team or a builder for what only a company must give", () => {
    const without = { ...company, website: null, industries: [], foundedYear: null };
    expect(
      missingProfileFacts({
        ...without,
        type: "builder_team",
        teamBackground: "Built two products.",
      }),
    ).toEqual([]);
    expect(missingProfileFacts({ ...without, type: "independent_builder" })).toEqual([]);
  });

  it("names every fact an organization created by an operator still lacks", () => {
    expect(
      missingProfileFacts({
        name: "Mekong AI",
        type: "builder_team",
        industries: [],
      } as unknown as Organization),
    ).toEqual(["teamSize", "country", "description", "teamBackground"]);
  });
});

describe("creationSchema", () => {
  const creation = creationSchema((key) => key);
  const refused = (values: ProfileValues) =>
    creation.safeParse(values).error?.issues.map((issue) => issue.path.join(".")) ?? [];
  const alone: ProfileValues = { ...profileValuesOf(), type: "independent_builder" };

  it("asks a builder on their own for a name and a country only", () => {
    expect(refused(alone)).toEqual(["name", "country"]);
    expect(refused({ ...alone, name: "An Tran", country: "VN" })).toEqual([]);
  });

  it("asks a team or a company for the whole profile", () => {
    expect(refused({ ...alone, type: "company", name: "An Tran", country: "VN" })).toEqual([
      "teamSize",
      "description",
      "website",
      "industries",
      "foundedYear",
    ]);
    expect(refused({ ...filled, type: "builder_team", teamBackground: "" })).toEqual([
      "teamBackground",
    ]);
  });

  it("sends a builder on their own as an organization of one", () => {
    expect(aloneBodyOf({ ...filled, name: " An Tran ", type: "independent_builder" })).toEqual({
      name: "An Tran",
      type: "independent_builder",
      teamSize: "just_me",
      industries: [],
      country: "VN",
    });
  });
});
