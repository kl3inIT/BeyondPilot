package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SolutionImage",
		description = "A stored image of a solution as its organization, and operators, see it. Its bytes are read "
				+ "at /api/storage/files/{fileId}.")
public record SolutionImageResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The stored file, sent back with a save to keep it.") UUID fileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
