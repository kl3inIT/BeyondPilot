package ai.genaifund.beyondpilot.organization;

import org.jspecify.annotations.Nullable;

/**
 * The organization a person applies through when they belong to none: themselves on their own, or their team.
 * @param type {@code independent_builder} or {@code builder_team}
 * @param country ISO 3166-1 alpha-2
 * @param teamSize {@code just_me} for one person; a band such as {@code 2_9} for a team
 */
public record ApplicantOrganization(String name, String type, String country, String teamSize,
		@Nullable String website) {
}
