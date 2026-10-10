package ai.genaifund.beyondpilot.matching.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MatchingFeedbackList",
		description = "What people said about the groups the AI gave: how often they agreed in the last 30 days, and one page of the answers that say a group is wrong, newest first. A person's last answer about a judgment is the one that counts.")
public record MatchingFeedbackListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many answers were given in the last 30 days.") long answers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of them agreed with the AI.") long agreements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many disagreements a page holds.") int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many disagreements there are, over all pages and whenever they were given.") long total) {

	@Schema(name = "MatchingDisagreement", description = "One answer that says the AI put a solution in the wrong group.")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID useCaseId,
			@Schema(types = { "string", "null" },
					description = "The title of the use case; null when it is no longer published.") @Nullable String useCaseTitle,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The candidate the answer is about, to open it among the solutions matched to its use case.") UUID candidateId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID solutionId,
			@Schema(types = { "string", "null" },
					description = "The name of the solution; null when it is no longer shown anywhere.") @Nullable String solutionName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The group the AI had given.",
					allowableValues = { "direct", "industry", "technology", "none" }) String aiBucket,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The group the person expected.",
					allowableValues = { "direct", "industry", "technology", "none" }) String expectedBucket,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The requirements the person says the AI judged wrongly.") List<Disputed> requirements,
			@Schema(types = { "string", "null" }) @Nullable String note,
			@Schema(types = { "string", "null" },
					description = "Who answered, by the name they are shown by; null for an account that no longer exists.") @Nullable String by,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant createdAt) {
	}

	@Schema(name = "MatchingDisputedRequirement", description = "A requirement a person says the AI judged wrongly.")
	public record Disputed(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Its place among the requirements of the use case, from 1.") int position,
			@Schema(types = { "string", "null" },
					description = "The two or three words it is shown by, empty when it has none; null when the answer is about an earlier judgment, whose requirements are no longer kept.") @Nullable String label,
			@Schema(types = { "string", "null" },
					description = "Its statement; null when the answer is about an earlier judgment.") @Nullable String statement) {
	}

}
