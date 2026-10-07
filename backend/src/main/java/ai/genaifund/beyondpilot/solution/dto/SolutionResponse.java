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
		@Schema(types = { "string", "null" }, description = "Null is unknown.",
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(types = { "string", "null" }) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> builtWith,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> deployment,
		@Schema(types = { "string", "null" }) @Nullable String channels,
		@Schema(types = { "string", "null" }) @Nullable String bestCustomerProfile,
		@Schema(types = { "object", "null" },
				description = "What GenAI Fund says of it; null until an operator writes it.") @Nullable SolutionBackingResponse backing,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }) @Nullable String demoUrl,
		@Schema(types = { "object", "null" }, description = "Its deck, when it has one.") @Nullable SolutionDeckResponse deck,
		@Schema(types = { "object", "null" }, description = "Its logo, when it has one.") @Nullable SolutionImageResponse logo,
		@Schema(types = { "object", "null" },
				description = "Its cover, when it has one.") @Nullable SolutionImageResponse cover,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The images shown under the cover, in their order.") List<SolutionImageResponse> images,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "approved", "rejected" }) String status,
		@Schema(types = { "string", "null" },
				allowableValues = { "not_an_ai_solution", "duplicate", "unverifiable", "other" },
				description = "Why it was refused for good; null for any other decision.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners with the last decision: what to change when it was "
						+ "sent back, or why it was refused.") @Nullable String decisionMessage,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When GenAI Fund took it down, while it is down; its status stays approved.") @Nullable Instant suspendedAt,
		@Schema(types = { "string", "null" },
				allowableValues = { "misleading_information", "not_an_ai_solution", "unverifiable", "breaks_the_rules",
						"other" },
				description = "Why GenAI Fund last took it down.") @Nullable String suspensionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners when taking it down.") @Nullable String suspensionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it has what a submission needs: a summary, a maturity, a focus area, an industry, "
						+ "a logo and a cover.") boolean complete,
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
