package ai.genaifund.beyondpilot.ai.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

@Schema(name = "SetDocumentReader",
		description = "What reads a page that is only a picture from now on: a model that reads images, or an OCR provider. One of the two, or neither to leave pages unread.")
public record SetDocumentReaderRequest(
		@Schema(types = { "string", "null" }, format = "uuid", description = "A chat model that reads images.") @Nullable UUID modelId,
		@Schema(types = { "string", "null" }, allowableValues = { "off", "low", "medium", "high" },
				description = "How hard the model reasons; null returns to the default of document reading. Ignored for an OCR provider.") @Pattern(regexp = "off|low|medium|high") @Nullable String reasoningEffort,
		@Schema(types = { "string", "null" }, format = "uuid", description = "A connected OCR provider.") @Nullable UUID ocrProviderId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the reader was read at.") long version) {
}
