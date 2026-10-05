package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "CustomerDeployment",
		description = "A customer deployment of a solution as its organization, and operators, see it.")
public record CustomerDeploymentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String customer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String problem,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String delivered,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "pilot", "production" }) String stage,
		@Schema(types = { "string", "null" }) @Nullable String channels,
		@Schema(types = { "string", "null" }) @Nullable String languages,
		@Schema(types = { "string", "null" }) @Nullable String period,
		@Schema(types = { "string", "null" }) @Nullable String result,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "submitted", "approved", "rejected" }) String status,
		@Schema(types = { "string", "null" }, allowableValues = { "incomplete", "unverifiable", "other" },
				description = "Why it was last rejected.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the owners with the rejection.") @Nullable String decisionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the deployment changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
