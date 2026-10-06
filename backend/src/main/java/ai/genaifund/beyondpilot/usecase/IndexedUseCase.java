package ai.genaifund.beyondpilot.usecase;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A published use case as search indexes it: what its public listing says.
 * @param organizationName null when the organization asked to stay anonymous, so no search finds it by that name
 * @param budgetMin null when the budget is to be determined or shown to members only
 * @param budgetMax null when the budget is to be determined or shown to members only
 * @param closesAt when it stops taking proposals; past it, search leaves it out
 */
public record IndexedUseCase(UUID id, String title, @Nullable String organizationName, @Nullable String industry,
		List<String> technologies, @Nullable String problemStatement, @Nullable String expectedOutcomes,
		@Nullable Integer budgetMin, @Nullable Integer budgetMax, boolean budgetToBeDetermined,
		boolean budgetMembersOnly, @Nullable Instant closesAt) {
}
