package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A solution of an organization as an application reads it, whatever its review says.
 * @param viewKey the key its shared page is read by, whatever its review says
 * @param slug the address of its public page
 * @param logoFileId its logo, or its organization's when it has none
 * @param approved whether it is approved and not taken down, so its public page answers
 * @param maturity {@code idea}, {@code prototype}, {@code pilot}, {@code production} or {@code scaled}
 */
public record OfferedSolution(UUID id, UUID organizationId, String name, @Nullable String summary,
		@Nullable String problemsSolved, @Nullable String maturity,
		UUID viewKey, String slug, @Nullable UUID logoFileId, boolean approved) {
}
