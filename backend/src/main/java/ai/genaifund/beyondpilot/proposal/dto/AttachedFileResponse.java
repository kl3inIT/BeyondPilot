package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AttachedFile", description = "A private PDF an application names, with its name and size.")
public record AttachedFileResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID fileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
