package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SolutionSummary", description = "One solution in a list of its organization or of the operators.")
public record SolutionSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "submitted", "approved", "rejected" }) String status,
		@Schema(types = { "string", "null" },
				allowableValues = { "incomplete", "not_an_ai_solution", "duplicate", "unverifiable", "other" },
				description = "Why it was last sent back.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners when sending it back.") @Nullable String decisionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What a review needs and it lacks, in the order of the editor: any of summary, "
						+ "maturity, industries, focusAreas, logo and cover. Empty when it can be sent for review.") List<String> missing,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of its customer deployments wait for review.") int deploymentsAwaitingReview) {
}
