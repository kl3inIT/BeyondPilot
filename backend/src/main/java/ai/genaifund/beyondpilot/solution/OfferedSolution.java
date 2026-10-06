package ai.genaifund.beyondpilot.solution;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A solution of an organization as an application reads it, whatever its review says.
 * @param maturity {@code idea}, {@code prototype}, {@code pilot}, {@code production} or {@code scaled}
 * @param deckFileId a private PDF of the solution
 */
public record OfferedSolution(UUID id, UUID organizationId, String name, @Nullable String summary,
		@Nullable String problemsSolved, @Nullable String maturity, @Nullable UUID deckFileId, @Nullable String demoUrl,
		List<String> builtWith, @Nullable String traction) {
}
