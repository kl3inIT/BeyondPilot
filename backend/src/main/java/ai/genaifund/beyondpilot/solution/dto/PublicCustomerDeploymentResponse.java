package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicCustomerDeployment", description = "An approved customer deployment as anyone reads it.")
public record PublicCustomerDeploymentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String customer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String problem,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String delivered,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "pilot", "production" }) String stage,
		@Schema(types = { "string", "null" }) @Nullable String channels,
		@Schema(types = { "string", "null" }) @Nullable String languages,
		@Schema(types = { "string", "null" }) @Nullable String period,
		@Schema(types = { "string", "null" }) @Nullable String result,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionSlug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "When GenAI Fund approved it.") Instant approvedAt) {
}
