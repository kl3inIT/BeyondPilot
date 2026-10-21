package ai.genaifund.beyondpilot.organization;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the operators' list of organizations, for the operators' MCP server: what an operator scans before
 * opening one.
 * @param total how many organizations match, over all pages
 */
public record OrganizationReviewList(long total, List<Item> items) {

	/**
	 * One organization in the list.
	 * @param status {@code active} or {@code merged}; one taken down stays active and has {@code suspendedAt}
	 * @param request what waits for an operator: {@code claim}; null when nothing does
	 */
	public record Item(UUID id, String name, String type, @Nullable String country, String status,
			@Nullable Instant suspendedAt, int members, boolean owned, @Nullable String request,
			@Nullable String askedBy, @Nullable Instant requestedAt, Instant createdAt, @Nullable String mergedInto) {
	}

}
