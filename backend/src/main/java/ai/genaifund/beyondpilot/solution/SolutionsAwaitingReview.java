package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * The solutions waiting for an operator's review, how many wait in all, and how many customer deployments wait, which
 * are reviewed on their solution.
 */
public record SolutionsAwaitingReview(long total, long deploymentsWaiting, List<Item> items) {

	public record Item(UUID id, String name, @Nullable String organizationName, @Nullable String summary,
			@Nullable Instant submittedAt) {
	}

}
