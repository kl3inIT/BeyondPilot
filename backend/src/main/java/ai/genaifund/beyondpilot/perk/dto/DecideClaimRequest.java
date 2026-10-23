package ai.genaifund.beyondpilot.perk.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "DecideClaim", description = "A partner's answer to a waiting request.")
public record DecideClaimRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean granted,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the list read; an answer is refused when the request changed since.") long version) {
}
