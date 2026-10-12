import { describe, expect, it } from "vitest";

import type { TalentProfile } from "@/lib/api/generated";

import {
  blankProject,
  missingForReview,
  talentBodyOf,
  talentSchema,
  talentValuesOf,
  type TalentValues,
} from "./talent-schemas";

const fresh = talentValuesOf(null, "Minh Trần");

const ready: TalentValues = {
  ...fresh,
  headline: "Founder building assistants for insurers",
  bio: "Ten years in insurance operations.",
  roles: ["ai_engineer"],
  skills: ["Python", "RAG"],
};

/** The fields a profile is refused at, each with what it says. */
function refusedAt(values: TalentValues, review: boolean) {
  const result = talentSchema((key) => key, review).safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

describe("talentSchema", () => {
  it("saves a draft that has a name and nothing else", () => {
    expect(refusedAt(fresh, false)).toEqual({});
    expect(refusedAt({ ...fresh, name: "  " }, false)).toEqual({ name: "nameRequired" });
  });

  it("asks a review for the headline, a role, a skill and the bio, each in its own words", () => {
    expect(refusedAt(fresh, true)).toEqual({
      headline: "needed.headline",
      roles: "needed.roles",
      skills: "needed.skills",
      bio: "needed.bio",
    });
    expect(refusedAt({ ...ready, headline: " ", bio: "\n" }, true)).toEqual({
      headline: "needed.headline",
      bio: "needed.bio",
    });
    expect(refusedAt(ready, true)).toEqual({});
  });

  it("asks every project for a title, on a save as on a review", () => {
    const values = {
      ...ready,
      projects: [
        { ...blankProject, title: "Renewals assistant" },
        { ...blankProject, title: " " },
      ],
    };
    expect(refusedAt(values, false)).toEqual({ "projects.1.title": "projects.titleRequired" });
    expect(refusedAt(values, true)).toEqual({ "projects.1.title": "projects.titleRequired" });
  });
});

describe("missingForReview", () => {
  it("names what a review needs and the form lacks, in the order of the form", () => {
    expect(missingForReview(fresh)).toEqual(["headline", "roles", "skills", "bio"]);
    expect(missingForReview({ ...ready, skills: [] })).toEqual(["skills"]);
    expect(missingForReview(ready)).toEqual([]);
  });

  it("leaves the name and the projects to the save", () => {
    expect(missingForReview({ ...ready, name: "", projects: [blankProject] })).toEqual([]);
  });
});

describe("talentValuesOf and talentBodyOf", () => {
  it("starts a first profile from the account's name, listed", () => {
    expect(fresh).toMatchObject({ name: "Minh Trần", listed: true, projects: [], rateBand: "" });
  });

  it("sends empty text as no value, leaves out a rate that was not stated, and keeps the version", () => {
    expect(talentBodyOf({ ...ready, city: " Đà Nẵng ", languages: ["vi"] }, null)).toEqual({
      name: "Minh Trần",
      headline: "Founder building assistants for insurers",
      bio: "Ten years in insurance operations.",
      roles: ["ai_engineer"],
      skills: ["Python", "RAG"],
      country: null,
      engagement: [],
      rateBand: undefined,
      website: null,
      photoFileId: null,
      city: "Đà Nẵng",
      languages: ["vi"],
      industries: [],
      worksAt: null,
      projects: [],
      listed: true,
      version: null,
    });
  });

  it("sends a project's year as a number and its empty members as none", () => {
    const body = talentBodyOf(
      {
        ...ready,
        projects: [{ title: "Renewals assistant", year: "2026", url: " ", summary: "", stage: "" }],
      },
      4,
    );
    expect(body.projects).toEqual([
      { title: "Renewals assistant", year: 2026, url: null, summary: null, stage: null },
    ]);
    expect(body.version).toBe(4);
  });

  it("holds a saved profile as the form's text and sends it back unchanged", () => {
    const profile = {
      name: "Đạt Phan",
      headline: "Advises insurers",
      bio: "Bio.",
      roles: ["advisor"],
      skills: ["Strategy"],
      engagement: ["advisory"],
      languages: ["vi", "en"],
      industries: ["insurance"],
      country: "VN",
      city: null,
      worksAt: null,
      website: "https://dat.example",
      photoFileId: "p1",
      rateBand: null,
      projects: [
        { title: "Claims triage", year: 2025, url: null, summary: "Sorted claims.", stage: null },
      ],
      listed: false,
      version: 7,
    } as unknown as TalentProfile;
    const values = talentValuesOf(profile, "ignored");
    expect(values.projects).toEqual([
      { title: "Claims triage", year: "2025", url: "", summary: "Sorted claims.", stage: "" },
    ]);
    expect(talentBodyOf(values, profile.version)).toMatchObject({
      name: "Đạt Phan",
      country: "VN",
      website: "https://dat.example",
      photoFileId: "p1",
      listed: false,
      version: 7,
      projects: [
        { title: "Claims triage", year: 2025, url: null, summary: "Sorted claims.", stage: null },
      ],
    });
  });
});
