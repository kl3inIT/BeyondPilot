package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** The talent profiles waiting for an operator's review, and how many wait in all. */
public record TalentAwaitingReview(long total, List<Item> items) {

	public record Item(UUID id, String name, @Nullable String headline, @Nullable Instant submittedAt) {
	}

}
