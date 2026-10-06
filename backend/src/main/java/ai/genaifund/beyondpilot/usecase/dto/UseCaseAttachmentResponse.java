package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseAttachment", description = "A file attached to a use case.")
public record UseCaseAttachmentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String mediaType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
