package ai.genaifund.beyondpilot.ai.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ChatSettings",
		description = "Everything the Chat tab of Admin › AI › Providers shows: the chat providers with their models, and the model each task uses. A key is never returned: each provider says only whether it has one.")
public record ChatSettingsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the server holds the key that encrypts provider keys; without it none can be saved.") boolean keysCanBeStored,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The APIs BeyondPilot speaks, as a provider's adapterType.") List<String> adapters,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Provider> providers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Task> tasks) {

	@Schema(name = "ChatProvider")
	public record Provider(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "openai") String adapterType,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String baseUrl,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean enabled,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean hasKey,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether a task uses one of its models.") boolean inUse,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Who saved it last, as they were named.") String updatedBy,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Send it back with a change; a change made meanwhile is refused.") long version,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Model> models) {
	}

	@Schema(name = "ChatModel", description = "A model an operator enabled. Prices are US dollars per million tokens; null is unknown.")
	public record Model(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String displayName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int contextWindow,
			@Schema(types = { "integer", "null" }) @Nullable Integer maxOutputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean toolCalling,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean vision,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean reasoning,
			@Schema(types = { "number", "null" }) @Nullable BigDecimal inputPrice,
			@Schema(types = { "number", "null" }) @Nullable BigDecimal outputPrice,
			@Schema(types = { "number", "null" }) @Nullable BigDecimal cachedInputPrice,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version) {
	}

	@Schema(name = "ChatTask", description = "A task and the model it uses.")
	public record Task(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "matching" }) String task,
			@Schema(types = { "string", "null" }, format = "uuid", description = "The model; null until an operator chooses one, and after its model is removed.") @Nullable UUID modelId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "off", "low", "medium", "high" },
					description = "How hard the task reasons, on a model that does; the task's own default until an operator sets one.") String reasoningEffort,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the task can run now: a model is chosen and its provider is switched on with a key.") boolean available,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version) {
	}

}
