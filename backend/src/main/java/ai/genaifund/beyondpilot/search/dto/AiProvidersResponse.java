package ai.genaifund.beyondpilot.search.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AiProviders",
		description = "The AI providers operators connected for embeddings, and the model search embeds with. A key is never returned: each provider says only whether it has one.")
public record AiProvidersResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the server holds the key that encrypts provider keys; without it none can be saved.") boolean keysCanBeStored,
		@Schema(description = "The model in use; null until an operator chooses one.") @Nullable EmbeddingModel embedding,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Provider> providers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The providers that can be connected, with their address and models.") List<Vendor> vendors,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version of the search settings; send it back to change the model.") long settingsVersion) {

	@Schema(name = "EmbeddingModelInUse")
	public record EmbeddingModel(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID providerId, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String providerName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String model, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int dimensions,
			@Schema(types = { "string", "null" }, format = "date-time", description = "When the model was chosen.") @Nullable Instant since,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Items embedded with this model.") long embedded,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Items in the index.") long total) {
	}

	@Schema(name = "AiProvider")
	public record Provider(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "openai", "openrouter" }) String vendor,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String baseUrl,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hasKey,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether search embeds with it; a provider in use cannot be deleted.") boolean inUse,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Who saved it last, as they were named.") String updatedBy,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Send it back with a change; a change made meanwhile is refused.") long version) {
	}

	@Schema(name = "AiVendor")
	public record Vendor(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "openai", "openrouter" }) String id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String baseUrl, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> models) {
	}

}
