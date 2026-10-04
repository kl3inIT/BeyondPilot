package ai.genaifund.beyondpilot.storage.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "StoredFile", description = "A file whose upload is confirmed.")
public record StoredFileResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String mediaType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sizeBytes) {
}
