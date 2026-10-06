package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SolutionDeck", description = "A solution's deck as its organization sees it. The file is private.")
public record SolutionDeckResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID fileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
