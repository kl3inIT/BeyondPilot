package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the operators' list of use cases, for the operators' MCP server: what an operator scans before opening
 * one.
 * @param total how many use cases match, over all pages
 */
public record UseCaseReviewList(long total, List<Item> items) {

	/**
	 * One use case in the list.
	 * @param status as a reader sees it now: {@code draft}, {@code in_review}, {@code needs_changes},
	 * {@code approved} or {@code closed} once its close date has passed
	 */
	public record Item(UUID id, @Nullable String title, String organizationName, String status,
			@Nullable Instant closesAt, @Nullable Instant featuredAt, Instant updatedAt) {
	}

}
