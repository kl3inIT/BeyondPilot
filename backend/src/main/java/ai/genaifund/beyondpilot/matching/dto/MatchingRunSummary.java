package ai.genaifund.beyondpilot.matching.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MatchingRunSummary",
		description = "One run of matching for a use case, with what its calls to the AI came to. Costs are estimates from the prices kept with each call.")
public record MatchingRunSummary(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID useCaseId,
		@Schema(types = { "string", "null" },
				description = "The title of the use case; null when it is no longer published.") @Nullable String useCaseTitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "queued", "running", "waiting", "done", "failed" }) String state,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What started it: the use case's approval or a change of it, an operator, a member, or a proposal sent or edited.",
				allowableValues = { "approved", "operator", "member", "proposal" }) String origin,
		@Schema(types = { "string", "null" },
				description = "Who started it, by the name they are shown by; null when the approval or a change did.") @Nullable String startedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version of the judgment's wording it ran with.") int promptVersion,
		@Schema(types = { "string", "null" }, description = "The model that judged; null until the run reached one.") @Nullable String modelName,
		@Schema(types = { "string", "null" }, description = "Why it failed or waits, as a code.") @Nullable String failure,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant startedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant endedAt,
		@Schema(types = { "integer", "null" },
				description = "How many solutions it judged itself; null for a run before the groups of each run were kept (16 October 2026).") @Nullable Integer judged,
		@Schema(types = { "integer", "null" },
				description = "How many it found unchanged and kept as judged before; null like judged.") @Nullable Integer kept,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Calls that reached the provider.") long calls,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Of them, the calls that failed.") long failedCalls,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Every input token, those read from and written to the provider's cache included.") long inputTokens,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long outputTokens,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Input tokens read from the provider's cache.") long cacheReadTokens,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Input tokens written to the provider's cache.") long cacheWriteTokens,
		@Schema(types = { "number", "null" },
				description = "The estimated cost in US dollars of the calls with a known price; null when none has one.") @Nullable BigDecimal cost,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Calls that answered without a known price, which the cost leaves out.") long unpricedCalls) {
}
