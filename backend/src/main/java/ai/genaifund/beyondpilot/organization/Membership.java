package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

/**
 * The organization a person acts for, as another module needs it to decide what they may do there.
 * @param type what kind of organization it is: company, builder_team, independent_builder or other
 * @param owner whether the person owns the organization; a plain member only reads what it holds
 * @param active whether the organization is active, meaning not taken down and not merged
 */
public record Membership(UUID organizationId, String organizationName, String type, boolean owner,
		boolean active) {

	/** The type of a builder on their own, an organization that stands for its one person. */
	public static final String INDIVIDUAL = "independent_builder";

	/** Whether the organization is the person on their own, rather than a company or a team. */
	public boolean individual() {
		return INDIVIDUAL.equals(type);
	}
}
