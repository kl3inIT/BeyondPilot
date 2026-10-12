import { z } from "zod";

import type { Organization, SaveOrganization } from "@/lib/api/generated";

import { organizationTypes } from "./organization-codes";
import { yearOf } from "./organization-format";

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
    logoFileId: organization?.logoFileId ?? "",
  };
}

/**
 * What the form checks before it asks the backend: that every fact is there. Whether the website is
 * an address is the backend's to say.
 */
export function profileSchema(say: Say) {
  const filled = (text: string) => text.trim() !== "";
  return z
    .object({
      name: z.string().refine(filled, say("nameRequired")),
      website: z.string().refine(filled, say("websiteRequired")),
      type: z.enum(organizationTypes),
      teamSize: z.string().min(1, say("teamSizeRequired")),
      industries: z.array(z.string()),
      country: z.string().min(1, say("countryRequired")),
      foundedYear: z.string().refine((text) => yearOf(text) !== null, say("foundedYearInvalid")),
      description: z.string().refine(filled, say("descriptionRequired")),
      logoFileId: z.string(),
    })
    .superRefine((values, context) => {
      // A company names its industries; a team or a builder on their own may not have settled on one.
      if (values.type === "company" && values.industries.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["industries"],
          message: say("industriesRequired"),
        });
      }
    });
}

/** The profile the backend takes, from values the schema passed. */
export function profileBodyOf(values: ProfileValues): Omit<SaveOrganization, "version"> {
  return {
    name: values.name.trim(),
    type: values.type,
    country: values.country,
    teamSize: values.teamSize as SaveOrganization["teamSize"],
    industries: values.industries,
    website: values.website.trim(),
    description: values.description.trim(),
    foundedYear: Number(values.foundedYear),
    logoFileId: values.logoFileId || null,
  };
}
