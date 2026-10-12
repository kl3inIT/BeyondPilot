package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicOffer", description = "An offer a solution comes with, as anyone reads it.")
public record PublicOfferResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it, such as \"$1,000 in cloud credits\".") String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True for an offer of GenAI Fund's list, which its card marks; false for one the "
						+ "solution's organization wrote.") boolean fromGenAiFund) {
}
