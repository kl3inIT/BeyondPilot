package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseChallenge",
		description = "The program a use case belongs to that takes applications now: whoever answers the use case applies to it, and sends no proposal.")
public record UseCaseChallengeResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of its public page, whose application form it opens.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Applications close at this instant.") Instant closesAt) {
}
