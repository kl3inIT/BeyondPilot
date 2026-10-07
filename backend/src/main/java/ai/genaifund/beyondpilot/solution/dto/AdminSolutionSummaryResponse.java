package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminSolutionSummary", description = "One solution in the operators' list.")
public record AdminSolutionSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "in_review", "needs_changes", "approved", "rejected" }) String status,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When GenAI Fund took it down, while it is down; its status stays approved.") @Nullable Instant suspendedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean listed,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(types = { "string", "null" },
				description = "Who sent it for review last: their name, or their address until they have one. "
						+ "Null when it was sent before the sender was recorded.") @Nullable String submittedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of its customer deployments wait for review.") int deploymentsAwaitingReview) {
}
