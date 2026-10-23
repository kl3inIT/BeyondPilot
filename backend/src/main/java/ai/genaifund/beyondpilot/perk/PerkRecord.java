package ai.genaifund.beyondpilot.perk;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A perk as an operator reads it on its admin page, for the operators' MCP server.
 * @param status {@code draft}, {@code published} or {@code archived}
 * @param audience {@code everyone}, {@code members}, {@code applicants} or {@code shortlisted}
 * @param way how it is got: {@code link}, {@code code}, {@code codes} or {@code request}
 * @param taken how many claims hold a place
 * @param waiting how many requests wait for an answer
 * @param codesLeft how many codes of its list are not given yet; null for a perk not given as a list
 */
public record PerkRecord(UUID id, String slug, String title, @Nullable String value,
		UUID organizationId, String organizationName, String status, String audience, String way,
		boolean fromGenAiFund, long taken, long waiting, @Nullable Integer places, @Nullable Integer codesLeft,
		@Nullable Instant endsAt, Instant updatedAt) {
}
