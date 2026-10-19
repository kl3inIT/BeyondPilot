package ai.genaifund.beyondpilot.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the accounts as operators list them, for a module that shows them outside the admin screen.
 * @param page the page, counted from 1
 * @param total how many accounts match, over all pages
 */
public record AccountList(List<Item> items, int page, int size, long total) {

	/**
	 * One account.
	 * @param role {@code user} or {@code operator}
	 * @param status {@code active} or {@code disabled}
	 */
	public record Item(UUID id, String email, @Nullable String displayName, String role, String status,
			@Nullable Instant lastSignInAt, Instant createdAt) {
	}

}
