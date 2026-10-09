package ai.genaifund.beyondpilot.ai.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AiUsageCallList",
		description = "One page of the calls BeyondPilot made to chat models and OCR services, newest first. No prompt, no answer and nothing a provider wrote is kept, so none is returned.")
public record AiUsageCallListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many calls a page holds.") int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many calls match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The tasks called in the period, to filter by.") List<String> tasks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The providers called in the period, by name, to filter by.") List<String> providers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The models called in the period, by name, to filter by.") List<String> models) {

	@Schema(name = "AiUsageCall")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant occurredAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "matching",
					description = "What the call was made for: a task, or `model_test` for a model tried by an operator.") String task,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "As the provider was named when the call was made.") String providerName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The model, or the API of an OCR service.") String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ok", "failed" }) String outcome,
			@Schema(types = { "string", "null" }, allowableValues = { "key_refused", "rate_limited", "too_large", "request_refused", "provider_failed", "no_answer",
					"failed" },
					description = "What a failed call was; null for a call that answered.") @Nullable String failure,
			@Schema(types = { "integer", "null" }, format = "int32",
					description = "The HTTP status the provider answered a failed call with; null when it gave none.") @Nullable Integer errorStatus,
			@Schema(types = { "integer", "null" }, format = "int64",
					description = "Input tokens, those read from a cache included; null for a failed call and for an OCR service.") @Nullable Long inputTokens,
			@Schema(types = { "integer", "null" }, format = "int64") @Nullable Long outputTokens,
			@Schema(types = { "integer", "null" }, format = "int64") @Nullable Long cacheReadTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long durationMs,
			@Schema(types = { "number", "null" },
					description = "The estimated cost in US dollars; null for a failed call and for one without a known price.") @Nullable BigDecimal estimatedCost,
			@Schema(types = { "string", "null" }, example = "solution_deck",
					description = "The kind of thing the call was about, as its caller named it.") @Nullable String subjectType,
			@Schema(types = { "string", "null" }) @Nullable String subjectId) {
	}

}
