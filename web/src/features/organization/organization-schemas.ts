import { z } from "zod";

import type { Organization, SaveOrganization } from "@/lib/api/generated";

import { organizationTypes } from "./organization-codes";
import { MAX_TEAM_BACKGROUND, yearOf } from "./organization-format";

/** What each field of the profile says when it is refused, here or by the backend. */
export const profileRefusals = {
  name: "nameRequired",
  website: "websiteInvalid",
  teamSize: "teamSizeRequired",
  industries: "industriesRequired",
  country: "countryRequired",
  foundedYear: "foundedYearInvalid",
  description: "descriptionRequired",
  teamBackground: "teamBackgroundRequired",
} as const;

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (
  key: (typeof profileRefusals)[keyof typeof profileRefusals] | "websiteRequired",
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

/**
 * What the form checks before it asks the backend: that every fact is there, and for a team or a
 * builder every fact but the three only a company must give. A year that is written is checked
 * whoever writes it. Whether the website is an address is the backend's to say.
 */
export function profileSchema(say: Say) {
  const filled = (text: string) => text.trim() !== "";
  return z
    .object({
      name: z.string().refine(filled, say("nameRequired")),
      website: z.string(),
      type: z.enum(organizationTypes),
      teamSize: z.string().min(1, say("teamSizeRequired")),
      industries: z.array(z.string()),
      country: z.string().min(1, say("countryRequired")),
      foundedYear: z
        .string()
        .refine((text) => !filled(text) || yearOf(text) !== null, say("foundedYearInvalid")),
      description: z.string().refine(filled, say("descriptionRequired")),
      teamBackground: z.string().max(MAX_TEAM_BACKGROUND, say("teamBackgroundRequired")),
      logoFileId: z.string(),
    })
    .superRefine((values, context) => {
      if (values.type === "builder_team" && !filled(values.teamBackground)) {
        context.addIssue({
          code: "custom",
          path: ["teamBackground"],
          message: say("teamBackgroundRequired"),
        });
      }
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

/** A fact of the profile the form may ask for, by its field. */
export type ProfileFact = keyof typeof profileRefusals;

/** The smaller profile written in the proposal dialog, with the same team rule as the full form. */
export function basicsSchema(say: Say) {
  return z
    .object({
      name: z.string().trim().min(1, say("nameRequired")).max(120, say("nameRequired")),
      type: z.enum(organizationTypes),
      teamSize: z.string().min(1, say("teamSizeRequired")),
      industries: z.array(z.string()).max(5, say("industriesRequired")),
      country: z.string().min(1, say("countryRequired")),
      teamBackground: z.string().max(MAX_TEAM_BACKGROUND, say("teamBackgroundRequired")),
    })
    .superRefine((values, context) => {
      if (values.type === "company" && values.industries.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["industries"],
          message: say("industriesRequired"),
        });
      }
      if (values.type === "builder_team" && !values.teamBackground.trim()) {
        context.addIssue({
          code: "custom",
          path: ["teamBackground"],
          message: say("teamBackgroundRequired"),
        });
      }
    });
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
    teamSize: values.teamSize as SaveOrganization["teamSize"],
    industries: values.industries,
    website: values.website.trim() || null,
    description: values.description.trim(),
    teamBackground: values.type === "builder_team" ? values.teamBackground.trim() || null : null,
    foundedYear: values.foundedYear.trim() ? Number(values.foundedYear) : null,
    logoFileId: values.logoFileId || null,
  };
}
