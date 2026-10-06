package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SolutionDeck", description = "The deck of a solution as its organization, and operators, see it.")
public record SolutionDeckResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The stored file, sent back with a save to keep it.") UUID fileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant attachedAt) {
}
