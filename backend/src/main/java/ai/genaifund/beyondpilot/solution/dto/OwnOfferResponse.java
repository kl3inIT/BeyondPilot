package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "OwnOffer", description = "An offer an organization wrote for its solutions, as its members read it.")
public record OwnOfferResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of the organization's solutions come with it; it is deleted only when none does.") int solutions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the offer changed since.") long version) {
}
