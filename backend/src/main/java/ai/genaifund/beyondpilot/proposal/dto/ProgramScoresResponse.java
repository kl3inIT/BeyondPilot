package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramScores",
		description = "Every scorer's score of each submitted application of a program, side by side, for an operator.")
public record ProgramScoresResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The most an application can score: 10, or the sum of the criteria's points.") double scale,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The operators who scored first, then the judges in the order they were invited.") List<Scorer> scorers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The submitted applications, the earliest submitted first.") List<Row> applications) {

	/**
	 * Someone whose scores count.
	 * @param role {@code reviewer} for a judge, {@code operator} for GenAI Fund
	 */
	@Schema(name = "ProgramScorer")
	public record Scorer(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "reviewer", "operator" }) String role) {
	}

	/**
	 * One application with each scorer's answer on it.
	 * @param reviewStatus GenAI Fund's decision: {@code under_review}, {@code shortlisted} or {@code not_selected}
	 */
	@Schema(name = "ProgramScoresRow")
	public record Row(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solution,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organization,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "under_review", "shortlisted", "not_selected" }) String reviewStatus,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Each scorer who scored it; a scorer missing here has not.") List<Cell> scores,
			@Schema(types = { "number", "null" },
					description = "The mean of every scorer's score, as the applications list reads it; null until one scores it.") @Nullable Double average,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many scored it.") int scored,
			@Schema(types = { "number", "null" },
					description = "The highest scorer's score less the lowest; null under two scores.") @Nullable Double spread) {
	}

	/** A scorer's score of an application: their mean over the criteria. */
	@Schema(name = "ProgramScoresCell")
	public record Cell(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) double score) {
	}

}
