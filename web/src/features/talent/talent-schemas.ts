import { z } from "zod";

import type { SaveTalentProfile, TalentProfile, TalentProject } from "@/lib/api/generated";

/** The limits the backend sets on a talent profile, repeated so a person meets them while writing. */
export const talentLimits = {
  roles: 4,
  skills: 15,
  skillLength: 40,
  projects: 6,
  languages: 6,
  industries: 5,
  bio: 4000,
} as const;

/** What a review needs, in the order of the form. */
export const reviewFields = ["headline", "roles", "skills", "bio"] as const;

type ReviewField = (typeof reviewFields)[number];

/** A project as its row of the form holds it. */
type ProjectValues = {
  title: string;
  year: string;
  url: string;
  summary: string;
  stage: string;
};

/** A talent profile as its form holds it: every field as text or a list, so none is uncontrolled. */
export type TalentValues = {
  photoFileId: string;
  name: string;
  worksAt: string;
  headline: string;
  country: string;
  city: string;
  roles: string[];
  skills: string[];
  engagement: string[];
  rateBand: string;
  bio: string;
  industries: string[];
  languages: string[];
  projects: ProjectValues[];
  website: string;
  listed: boolean;
};

export const blankProject: ProjectValues = { title: "", year: "", url: "", summary: "", stage: "" };

/** What the form starts from: the profile as it was last saved, or a new one under the account's name. */
export function talentValuesOf(profile: TalentProfile | null, suggestedName: string): TalentValues {
  return {
    photoFileId: profile?.photoFileId ?? "",
    name: profile?.name ?? suggestedName,
    worksAt: profile?.worksAt ?? "",
    headline: profile?.headline ?? "",
    country: profile?.country ?? "",
    city: profile?.city ?? "",
    roles: profile?.roles ?? [],
    skills: profile?.skills ?? [],
    engagement: profile?.engagement ?? [],
    rateBand: profile?.rateBand ?? "",
    bio: profile?.bio ?? "",
    industries: profile?.industries ?? [],
    languages: profile?.languages ?? [],
    projects: (profile?.projects ?? []).map((project) => ({
      title: project.title,
      year: project.year ? String(project.year) : "",
      url: project.url ?? "",
      summary: project.summary ?? "",
      stage: project.stage ?? "",
    })),
    website: profile?.website ?? "",
    listed: profile?.listed ?? true,
  };
}

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (key: "nameRequired" | "projects.titleRequired" | `needed.${ReviewField}`) => string;

/**
 * What the form checks before it asks the backend. Any save needs a name and a title for every
 * project; with `review`, also what a review needs, which the backend checks the same.
 */
export function talentSchema(say: Say, review: boolean) {
  const filled = (text: string) => text.trim() !== "";
  const needed = (field: ReviewField) => (review ? say(`needed.${field}`) : undefined);
  return z.object({
    photoFileId: z.string(),
    name: z.string().refine(filled, say("nameRequired")),
    worksAt: z.string(),
    headline: z.string().refine((text) => !review || filled(text), needed("headline")),
    country: z.string(),
    city: z.string(),
    roles: z.array(z.string()).refine((list) => !review || list.length > 0, needed("roles")),
    skills: z.array(z.string()).refine((list) => !review || list.length > 0, needed("skills")),
    engagement: z.array(z.string()),
    rateBand: z.string(),
    bio: z.string().refine((text) => !review || filled(text), needed("bio")),
    industries: z.array(z.string()),
    languages: z.array(z.string()),
    projects: z.array(
      z.object({
        title: z.string().refine(filled, say("projects.titleRequired")),
        year: z.string(),
        url: z.string(),
        summary: z.string(),
        stage: z.string(),
      }),
    ),
    website: z.string(),
    listed: z.boolean(),
  });
}

/** What a review needs and the form does not hold yet, in the order of the form. */
export function missingForReview(values: TalentValues): ReviewField[] {
  const result = talentSchema(() => "", true).safeParse(values);
  const refused = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
  return reviewFields.filter((field) => refused.includes(field));
}

/** The save the backend takes: empty text is no value, and the name and the titles go as written. */
export function talentBodyOf(values: TalentValues, version: number | null): SaveTalentProfile {
  const text = (value: string) => value.trim() || null;
  return {
    name: values.name,
    headline: text(values.headline),
    bio: text(values.bio),
    roles: values.roles,
    skills: values.skills,
    country: values.country || null,
    engagement: values.engagement,
    rateBand: (values.rateBand || undefined) as SaveTalentProfile["rateBand"],
    website: text(values.website),
    photoFileId: values.photoFileId || null,
    city: text(values.city),
    languages: values.languages as SaveTalentProfile["languages"],
    industries: values.industries as SaveTalentProfile["industries"],
    worksAt: text(values.worksAt),
    projects: values.projects.map((project) => ({
      title: project.title,
      year: project.year ? Number(project.year) : null,
      url: text(project.url),
      summary: text(project.summary),
      stage: (project.stage || null) as TalentProject["stage"],
    })),
    listed: values.listed,
    version,
  };
}
