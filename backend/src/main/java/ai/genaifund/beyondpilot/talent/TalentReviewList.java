package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the operators' list of submitted talent profiles, for the operators' MCP server: what an operator scans
 * before opening one.
 * @param total how many profiles match, over all pages
 */
public record TalentReviewList(long total, List<Item> items) {

	/**
	 * One profile in the list.
	 * @param status GenAI Fund's review: {@code in_review}, {@code needs_changes} or {@code approved}; one taken down
	 * stays approved and has {@code suspendedAt}
	 */
	public record Item(UUID id, String name, String email, @Nullable String headline, String status,
			@Nullable Instant suspendedAt, boolean listed, @Nullable Instant featuredAt, @Nullable Instant submittedAt,
			Instant updatedAt) {
	}

}
