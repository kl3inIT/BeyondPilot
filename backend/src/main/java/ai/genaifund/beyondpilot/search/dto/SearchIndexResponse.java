package ai.genaifund.beyondpilot.search.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SearchIndex", description = "What search can find by keyword, and how much of it is embedded for semantic search.")
public record SearchIndexResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Semantic semantic, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Kind> kinds,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Items the provider refused, tried again on their own later.") List<HeldBack> heldBack,
		@Schema(description = "The last rebuild since the application started.") @Nullable Rebuild lastRebuild,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version of the search settings; send it back to switch semantic search.") long settingsVersion) {

	@Schema(name = "SemanticSearchState")
	public record Semantic(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether an operator turned semantic search on.") boolean enabled,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "on", "off", "paused", "no_provider" },
					description = "How it goes: on, turned off, paused after the provider failed, or on without a usable provider.") String state,
			@Schema(types = { "string", "null" }) @Nullable String providerName, @Schema(types = { "string", "null" }) @Nullable String model,
			@Schema(types = { "string", "null" }, format = "date-time", description = "When the provider is tried again.") @Nullable Instant pausedUntil,
			@Schema(types = { "string", "null" }, allowableValues = { "rejected", "model_refused", "unreachable" }, description = "Why it is paused.") @Nullable String failure,
			@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant lastBatchAt) {
	}

	@Schema(name = "SearchIndexKind")
	public record Kind(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "program", "solution", "talent", "use_case" }) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What visitors may find; unlisted items stay for operators matching use cases.") long listed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long embedded, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long waiting, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long heldBack) {
	}

	@Schema(name = "SearchIndexHeldBack")
	public record HeldBack(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "program", "solution", "talent", "use_case" }) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID itemId, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "bad_request", "unprocessable", "refused" }) String reason,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int attempts,
			@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant nextAttemptAt) {
	}

	@Schema(name = "SearchIndexRebuild")
	public record Rebuild(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant at,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Items read from their modules.") int saved,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Rows taken out because their item is no longer published.") int removed) {
	}

}
