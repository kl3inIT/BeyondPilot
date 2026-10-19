package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the operators' list of submitted solutions, for the operators' MCP server: what an operator scans
 * before opening one.
 * @param total how many solutions match, over all pages
 */
public record SolutionReviewList(long total, List<Item> items) {

	/**
	 * One solution in the list.
	 * @param status GenAI Fund's review: {@code in_review}, {@code needs_changes}, {@code approved} or
	 * {@code rejected}; one taken down stays approved and has {@code suspendedAt}
	 */
	public record Item(UUID id, String name, String organizationName, @Nullable String summary,
			List<String> industries, @Nullable String maturity, String status, @Nullable Instant suspendedAt,
			boolean listed, @Nullable Instant featuredAt, @Nullable Instant submittedAt, @Nullable String submittedBy,
			Instant updatedAt, int deploymentsAwaitingReview) {
	}

}
