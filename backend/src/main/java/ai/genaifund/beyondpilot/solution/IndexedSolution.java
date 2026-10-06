package ai.genaifund.beyondpilot.solution;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An approved solution as search indexes it: what its page says, who offers it, and whether its owners list it.
 * @param customerDeployments how many of its customer deployments GenAI Fund approved
 * @param listed false when its owners keep it out of the directory; matching may still use it
 */
public record IndexedSolution(UUID id, String slug, String name, UUID organizationId, String organizationName,
		String organizationSlug, @Nullable String country, @Nullable String summary, @Nullable String problemsSolved,
		@Nullable String valueProposition, @Nullable String traction, @Nullable String bestCustomerProfile,
		List<String> builtWith, List<String> focusAreas, List<String> industries, @Nullable String maturity,
		List<String> deployment, int customerDeployments, boolean listed) {
}
