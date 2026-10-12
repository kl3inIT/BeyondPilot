package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SearchOffer", description = "An offer a solution in the results comes with.")
public record SearchOffer(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True for an offer of GenAI Fund's list.") boolean fromGenAiFund) {
}
