package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOffer", description = "An offer as an operator reads it, with the organization that gives it.")
public record AdminOfferResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization that gives it.") UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The name of that organization.") String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True when GenAI Fund arranged it with the organization, which its card marks.") boolean fromGenAiFund,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions come with it; it is deleted only when none does.") int solutions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the offer changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True once it is closed to new solutions; the solutions that come with it keep it.") boolean closed) {
}
