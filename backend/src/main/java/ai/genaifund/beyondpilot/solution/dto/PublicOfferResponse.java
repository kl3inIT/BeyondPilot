package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicOffer", description = "An offer a solution comes with, as anyone reads it.")
public record PublicOfferResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it, such as \"$1,000 in cloud credits\".") String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True when GenAI Fund arranged it with the solution's organization, which its card "
						+ "marks; false for one the organization wrote alone.") boolean fromGenAiFund) {
}
