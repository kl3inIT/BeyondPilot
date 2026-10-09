package ai.genaifund.beyondpilot.ai.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OcrSettings",
		description = "Everything the OCR tab of Admin › AI › Providers shows: the OCR providers, and what reads a page that is only a picture. A key is never returned: each provider says only whether it has one.")
public record OcrSettingsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the server holds the key that encrypts provider keys; without it none can be saved.") boolean keysCanBeStored,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The OCR APIs BeyondPilot speaks, as the adapterType of a provider.") List<String> adapters,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Provider> providers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Reader reader) {

	@Schema(name = "OcrProvider")
	public record Provider(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "aihay") String adapterType,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String baseUrl,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean enabled,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hasKey,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether it is the reader.") boolean inUse,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Who saved it last, as they were named.") String updatedBy,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Send it back with a change; a change made meanwhile is refused.") long version) {
	}

	@Schema(name = "DocumentReader",
			description = "What reads a page that is only a picture: a chat model, an OCR provider, or nothing yet.")
	public record Reader(
			@Schema(types = { "string", "null" }, format = "uuid", description = "The chat model that reads pages; null when an OCR provider does, or nothing.") @Nullable UUID modelId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "off", "low", "medium", "high" },
					description = "How hard the model reasons, on a model that does.") String reasoningEffort,
			@Schema(types = { "string", "null" }, format = "uuid", description = "The OCR provider that reads pages; null when a model does, or nothing.") @Nullable UUID ocrProviderId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether pages can be read now: a reader is chosen, and it is switched on with a key.") boolean available,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version) {
	}

}
