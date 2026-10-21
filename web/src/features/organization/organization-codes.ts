/** The codes of the organization module, in the order a select offers them. */

export const organizationTypes = [
  "company",
  "builder_team",
  "independent_builder",
  "other",
] as const;

/**
 * Whether the organization is a person on their own: an ordinary organization of one person, which
 * has no other member, invitation or email domain.
 */
export function isIndividual(organization: { type: string }): boolean {
  return organization.type === "independent_builder";
}

export const teamSizes = [
  "just_me",
  "2_9",
  "10_49",
  "50_99",
  "100_499",
  "500_999",
  "1000_4999",
  "5000_plus",
] as const;

/**
 * The sizes an organization of this type may choose: just me goes with a person on their own, and
 * a team, a company or another organization says how many people it has.
 */
export function teamSizesFor(type: string): readonly (typeof teamSizes)[number][] {
  return type === "independent_builder"
    ? ["just_me"]
    : teamSizes.filter((size) => size !== "just_me");
}

/**
 * The size an organization has once its type changes: just me for a person on their own, and for
 * one that stops being that, a size chosen again, as its form asks.
 */
export function teamSizeAfterTypeChange(type: string, current: string): string {
  if (type === "independent_builder") {
    return "just_me";
  }
  return current === "just_me" ? "" : current;
}

/** The industries an organization works in or serves; a solution is filed under the same ones. */
export const industries = [
  "banking_finance",
  "insurance",
  "retail_ecommerce",
  "manufacturing",
  "logistics",
  "healthcare",
  "education",
  "real_estate",
  "telecom",
  "energy",
  "agriculture",
  "travel_hospitality",
  "media_entertainment",
  "public_sector",
  "professional_services",
  "technology",
  "automotive_mobility",
  "consumer_goods",
  "climate_sustainability",
  "marketing_advertising",
  "legal",
  "hr_workforce",
  "other",
] as const;

export const takeDownReasons = [
  "misleading_information",
  "not_a_real_organization",
  "breaks_the_rules",
  "other",
] as const;

/**
 * What the operators' list filters by: `active` for every organization that is not down, `claimed`
 * for those with an open ownership claim, `suspended` for those taken down, and `merged` for
 * duplicates, which no other filter lists.
 */
export const organizationStatuses = ["active", "claimed", "suspended", "merged"] as const;
