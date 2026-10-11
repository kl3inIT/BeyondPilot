package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A solution of an organization as an application reads it, whatever its review says.
 * @param status {@code draft}, {@code in_review}, {@code needs_changes}, {@code approved} or {@code rejected}
 * @param maturity {@code idea}, {@code prototype}, {@code pilot}, {@code production} or {@code scaled}
 */
public record OfferedSolution(UUID id, UUID organizationId, String name, @Nullable String summary,
		@Nullable String problemsSolved, @Nullable String maturity, String status) {
}
