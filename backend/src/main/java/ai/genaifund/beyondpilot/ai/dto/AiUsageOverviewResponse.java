package ai.genaifund.beyondpilot.ai.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AiUsageOverview",
		description = "The Overview of Admin › AI › Usage: what is failing, what the calls of a period came to, the calls over time and where they went. Costs are estimates in US dollars from the usage providers report and the prices kept with each call, not invoices.")
public record AiUsageOverviewResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "today", "7d", "30d" }) String period,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Totals totals,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The tasks failing on a model in the last 24 hours, whatever the period: at least 5 failed calls that are at least 10% of its calls. The one with the most failures first.") List<Failing> failing,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "hour", "day" },
				description = "What one entry of the series covers: an hour for today, a day otherwise.") String seriesStep,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The calls by hour or by day, oldest first, those without calls included.") List<Bucket> series,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "model", "task", "provider" }) String by,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Where the calls went, the group with the most calls first.") List<Group> breakdown) {

	@Schema(name = "AiUsageTotals")
	public record Totals(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long calls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long succeeded,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long failed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Input tokens, those read from a cache included.") long inputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long outputTokens,
			@Schema(types = { "number", "null" },
					description = "The estimated cost of the calls with a known price; null when none has one.") @Nullable BigDecimal estimatedCost,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How many calls the cost is computed from.") long pricedCalls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How many calls answered without a known price. They add nothing to the cost.") long unpricedCalls) {
	}

	@Schema(name = "AiUsageFailing")
	public record Failing(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "document_reading") String task,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String providerName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long calls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long failed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant lastFailedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "key_refused", "rate_limited", "too_large", "request_refused", "provider_failed", "no_answer",
					"failed" }) String lastFailure) {
	}

	@Schema(name = "AiUsageBucket")
	public record Bucket(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time",
					description = "When the hour or the day starts.") Instant start,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long succeeded,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long failed) {
	}

	@Schema(name = "AiUsageGroup", description = "The calls of one group. The names the grouping does not hold are null.")
	public record Group(@Schema(types = { "string", "null" }) @Nullable String modelName,
			@Schema(types = { "string", "null" }) @Nullable String providerName,
			@Schema(types = { "string", "null" }) @Nullable String task,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long calls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long failed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long inputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long outputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How long a call took on average, in milliseconds.") long averageDurationMs,
			@Schema(types = { "number", "null" },
					description = "Null when no call of the group has a known price.") @Nullable BigDecimal estimatedCost) {
	}

}
