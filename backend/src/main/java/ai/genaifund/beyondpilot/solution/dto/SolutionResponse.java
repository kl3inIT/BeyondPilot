package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Solution", description = "A solution as its organization, and operators, see it.")
public record SolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Nullable String valueProposition,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" }, description = "Null is unknown.",
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> deployment,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }) @Nullable String demoUrl,
		@Schema(types = { "string", "null" }) @Nullable String deckUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "submitted", "approved", "rejected" }) String status,
		@Schema(types = { "string", "null" },
				allowableValues = { "incomplete", "not_an_ai_solution", "duplicate", "unverifiable", "other" },
				description = "Why it was last rejected.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners with the rejection.") @Nullable String decisionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it has what a submission needs: a summary, a maturity, a focus area and an industry.") boolean complete,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(types = { "string", "null" },
				description = "Who sent it for review last: their name, or their address until they have one. "
						+ "Null when it was never sent, or was sent before the sender was recorded.") @Nullable String submittedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the solution changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its customer deployments, the newest first, whatever their review says.") List<CustomerDeploymentResponse> customerDeployments) {
}
