package ai.genaifund.beyondpilot.organization;

import java.util.List;
import java.util.UUID;

/**
 * The organization a person acts for, as another module needs it to decide what they may do there.
 * @param owner whether the person owns the organization; a plain member only reads what it holds
 * @param approved whether GenAI Fund has approved the organization
 * @param roles what the organization does here: {@code provider}, {@code enterprise} or both
 */
public record Membership(UUID organizationId, String organizationName, boolean owner, boolean approved,
		List<String> roles) {

	public boolean provides() {
		return roles.contains("provider");
	}
}
