package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminOfferSolution", description = "A solution that comes with an offer, as the operators' record of it lists it.")
public record AdminOfferSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Where it stands in review, as the solution records it.") String status,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When GenAI Fund took it down, while it is down; its status stays approved.") @Nullable Instant suspendedAt) {
}
