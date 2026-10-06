package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicSolutionDeck",
		description = "The deck of an approved solution. Its bytes are read at the address of the solution followed by /deck.")
public record PublicSolutionDeckResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
