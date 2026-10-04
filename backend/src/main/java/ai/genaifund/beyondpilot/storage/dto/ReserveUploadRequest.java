package ai.genaifund.beyondpilot.storage.dto;

import ai.genaifund.beyondpilot.storage.FilePurpose;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@Schema(name = "ReserveUpload", description = "The file a person is about to upload.")
public record ReserveUploadRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Why the file is uploaded; it fixes the allowed media types and the largest size.") @NotNull FilePurpose purpose,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The name of the file, kept to show and to download under.") @NotBlank @Size(
						max = 255) String fileName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "application/pdf") @NotBlank @Size(
				max = 127) String mediaType,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The exact length of the file in bytes.") @Positive long sizeBytes) {
}
