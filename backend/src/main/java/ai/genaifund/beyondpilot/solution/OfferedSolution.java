package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A solution of an organization as an application reads it, whatever its review says.
 * @param viewKey the key its shared page is read by, whatever its review says
 * @param slug the address of its public page
 * @param logoFileId its logo, or its organization's when it has none
 * @param approved whether it is approved and not taken down, so its public page answers
 * @param sent whether it was ever sent to GenAI Fund: anything but a draft
 * @param maturity {@code idea}, {@code prototype}, {@code pilot}, {@code production} or {@code scaled}
 * @param demoUrl where the product is shown working, when its organization gave a link
 */
public record OfferedSolution(UUID id, UUID organizationId, String name, @Nullable String summary,
		@Nullable String problemsSolved, @Nullable String maturity, @Nullable String demoUrl,
		UUID viewKey, String slug, @Nullable UUID logoFileId, boolean approved, boolean sent) {
}
