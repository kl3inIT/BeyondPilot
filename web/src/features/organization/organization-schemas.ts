import { z } from "zod";

import type { Organization, SaveOrganization, SaveOrganizationBasics } from "@/lib/api/generated";

import { organizationTypes } from "./organization-codes";
import {
  MAX_DESCRIPTION,
  MAX_INDUSTRIES,
  MAX_TEAM_BACKGROUND,
  yearOf,
} from "./organization-format";

/** What each field of the profile says when it is refused, here or by the backend. */
export const profileRefusals = {
  name: "nameRequired",
  website: "websiteInvalid",
  teamSize: "teamSizeRequired",
  industries: "industriesRequired",
  country: "countryRequired",
  foundedYear: "foundedYearInvalid",
  description: "descriptionRequired",
} as const;

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (
  key: (typeof profileRefusals)[keyof typeof profileRefusals] | "websiteRequired" | "typeRequired",
) => string;

/** An organization's profile as its form holds it: every field as text, so none is uncontrolled. */
export type ProfileValues = {
  name: string;
  website: string;
  type: Organization["type"];
  teamSize: string;
  industries: string[];
  country: string;
  foundedYear: string;
  description: string;
  teamBackground: string;
  logoFileId: string;
};

/** What the form starts from: the organization's profile, or an empty one for a new company. */
export function profileValuesOf(organization?: Organization): ProfileValues {
  return {
    name: organization?.name ?? "",
    website: organization?.website ?? "",
    type: organization?.type ?? "company",
    teamSize: organization?.teamSize ?? "",
    industries: organization?.industries ?? [],
    country: organization?.country ?? "",
    foundedYear: String(organization?.foundedYear ?? ""),
    description: organization?.description ?? "",
    teamBackground: organization?.teamBackground ?? "",
    logoFileId: organization?.logoFileId ?? "",
  };
}

/**
 * Whether an organization of this type must give its website, the year it started and its
 * industries. A company must; a team or a builder on their own may have none yet.
 */
export function givesCompanyFacts(type: Organization["type"]): boolean {
  return type === "company";
}

const filled = (text: string) => text.trim() !== "";

/** Each fact of the profile on its own, before what one fact asks of another. */
function profileFacts(say: Say) {
  return z.object({
    name: z.string().refine(filled, say("nameRequired")).max(120, say("nameRequired")),
    website: z.string().max(300, say("websiteInvalid")),
    type: z.enum(organizationTypes),
    teamSize: z.string().min(1, say("teamSizeRequired")),
    industries: z.array(z.string()).max(MAX_INDUSTRIES, say("industriesRequired")),
    country: z.string().min(1, say("countryRequired")),
    foundedYear: z
      .string()
      .refine((text) => !filled(text) || yearOf(text) !== null, say("foundedYearInvalid")),
    description: z
      .string()
      .refine(filled, say("descriptionRequired"))
      .max(MAX_DESCRIPTION, say("descriptionRequired")),
    // Historical API data is preserved by the full profile form, not collected as a separate field.
    teamBackground: z.string().max(MAX_TEAM_BACKGROUND),
    logoFileId: z.string(),
  });
}

/**
 * What the form checks before it asks the backend: that every fact is there, and for a team or a
 * builder every fact but the three only a company must give. A year that is written is checked
 * whoever writes it. Whether the website is an address is the backend's to say.
 */
export function profileSchema(say: Say) {
  return profileFacts(say).superRefine((values, context) => {
    if (!givesCompanyFacts(values.type)) {
      return;
    }
    const missing = {
      website: !filled(values.website) && say("websiteRequired"),
      industries: values.industries.length === 0 && say("industriesRequired"),
      foundedYear: !filled(values.foundedYear) && say("foundedYearInvalid"),
    };
    for (const [field, message] of Object.entries(missing)) {
      if (message) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    }
  });
}

/** Whether a new organization is a builder on their own, who is asked a name and a country only. */
export function createsAlone(type: Organization["type"]): boolean {
  return type === "independent_builder";
}

/**
 * What the create page checks. A builder on their own gives a name and a country, and writes the
 * rest of the profile later; a team or a company gives the whole profile.
 */
export function creationSchema(say: Say): z.ZodType<ProfileValues, ProfileValues> {
  const whole = profileSchema(say);
  const alone = profileFacts(say).pick({ name: true, country: true });
  return z.custom<ProfileValues>().superRefine((values, context) => {
    const checked = (createsAlone(values.type) ? alone : whole).safeParse(values);
    for (const issue of checked.error?.issues ?? []) {
      context.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
  });
}

/** What a builder on their own sends to be created: their name and country, as an organization of one. */
export function aloneBodyOf(values: ProfileValues): SaveOrganizationBasics {
  return {
    name: values.name.trim(),
    type: "independent_builder",
    teamSize: "just_me",
    industries: [],
    country: values.country,
  };
}

/** A fact of the profile the form may ask for, by its field. */
export type ProfileFact = keyof typeof profileRefusals;

/** The required-only popup keeps inactive values locally so changing type does not lose input. */
export type BasicsValues = Pick<
  ProfileValues,
  | "name"
  | "type"
  | "teamSize"
  | "industries"
  | "country"
  | "website"
  | "foundedYear"
  | "description"
>;

export function basicsValuesOf(organization?: Organization): BasicsValues {
  const { name, type, teamSize, industries, country, website, foundedYear, description } =
    profileValuesOf(organization);
  return { name, type, teamSize, industries, country, website, foundedYear, description };
}

/** Apply the full form's creation rules to active facts only; never block on an invisible field. */
export function basicsSchema(say: Say) {
  const creation = creationSchema(say);
  return z
    .object({
      name: z.string(),
      type: z.enum(organizationTypes),
      teamSize: z.string(),
      industries: z.array(z.string()),
      country: z.string(),
      website: z.string(),
      foundedYear: z.string(),
      description: z.string(),
    })
    .superRefine((values, context) => {
      if (values.type === "other") {
        context.addIssue({ code: "custom", path: ["type"], message: say("typeRequired") });
      }
      const company = givesCompanyFacts(values.type);
      const checked = creation.safeParse({
        ...profileValuesOf(),
        ...values,
        website: company ? values.website : "",
        industries: company ? values.industries : [],
        foundedYear: company ? values.foundedYear : "",
      });
      for (const issue of checked.error?.issues ?? []) {
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
      }
    });
}

/** Only the selected type's editable facts leave the popup; defaults represent hidden facts. */
export function basicsBodyOf(values: BasicsValues, version?: number): SaveOrganizationBasics {
  if (values.type === "other") {
    throw new Error("Choose one of the three creation types before submitting.");
  }
  const company = givesCompanyFacts(values.type);
  const alone = createsAlone(values.type);
  return {
    name: values.name.trim(),
    type: values.type,
    teamSize: (alone ? "just_me" : values.teamSize) as SaveOrganizationBasics["teamSize"],
    industries: company ? values.industries : [],
    country: values.country,
    website: company ? values.website.trim() : null,
    foundedYear: company ? yearOf(values.foundedYear) : null,
    description: alone ? null : values.description.trim(),
    version: version ?? null,
  };
}

/**
 * The facts a saved organization still lacks, in the order of the form: what `profileSchema` would
 * refuse of it, so nothing is called missing that the form does not ask of an organization of its
 * type.
 */
export function missingProfileFacts(organization: Organization): ProfileFact[] {
  const result = profileSchema((key) => key).safeParse(profileValuesOf(organization));
  if (result.success) {
    return [];
  }
  const refused = new Set(result.error.issues.map((issue) => issue.path[0]));
  return (Object.keys(profileRefusals) as ProfileFact[]).filter((fact) => refused.has(fact));
}

/** The profile the backend takes, from values the schema passed. */
export function profileBodyOf(values: ProfileValues): Omit<SaveOrganization, "version"> {
  return {
    name: values.name.trim(),
    type: values.type,
    country: values.country,
    // One person is just me, whatever the form still held.
    teamSize: (values.type === "independent_builder"
      ? "just_me"
      : values.teamSize) as SaveOrganization["teamSize"],
    industries: values.industries,
    website: values.website.trim() || null,
    description: values.description.trim(),
    teamBackground: values.teamBackground.trim() || null,
    foundedYear: values.foundedYear.trim() ? Number(values.foundedYear) : null,
    logoFileId: values.logoFileId || null,
  };
}
