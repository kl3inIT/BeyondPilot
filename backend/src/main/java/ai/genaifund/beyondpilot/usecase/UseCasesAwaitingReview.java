package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** The use cases waiting for an operator's review, and how many wait in all. */
public record UseCasesAwaitingReview(long total, List<Item> items) {

	public record Item(UUID id, @Nullable String title, @Nullable String organizationName, Instant updatedAt) {
	}

}
