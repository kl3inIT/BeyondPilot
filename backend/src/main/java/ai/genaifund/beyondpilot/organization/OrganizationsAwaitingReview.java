package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** The organizations waiting for an operator's review, and how many wait in all. */
public record OrganizationsAwaitingReview(long total, List<Item> items) {

	public record Item(UUID id, String name, String type, @Nullable String country, Instant createdAt) {
	}

}
