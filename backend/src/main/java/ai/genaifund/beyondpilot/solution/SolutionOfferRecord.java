package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An offer solutions come with, as the operators' offer page shows it, for the operators' MCP server. Offers have no
 * review: an offer is open to new solutions or closed.
 * @param solutions how many solutions come with it
 * @param solutionList the solutions that come with it, by name; empty in a list of offers
 */
public record SolutionOfferRecord(UUID id, String title, String url, UUID organizationId, String organizationName,
		boolean fromGenAiFund, boolean closed, int solutions, @Nullable Instant createdAt, Instant updatedAt,
		List<Solution> solutionList) {

	/**
	 * A solution that comes with the offer.
	 * @param status its review, as the solution records it
	 */
	public record Solution(UUID id, String name, String organizationName, String status,
			@Nullable Instant suspendedAt) {
	}

}
