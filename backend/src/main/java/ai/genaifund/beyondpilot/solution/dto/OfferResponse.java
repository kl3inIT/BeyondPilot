package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "Offer", description = "An offer a solution comes with, such as cloud credits.")
public record OfferResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it, such as \"$1,000 in cloud credits\".") String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True when GenAI Fund arranged it with the organization; false for one the organization wrote alone.") boolean fromGenAiFund,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True once it is closed to new solutions; the solutions that come with it keep it.") boolean closed) {
}
