package ai.genaifund.beyondpilot.matching.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EvaluationCandidateDetail",
		description = "One candidate of a program's evaluation with its current assessment and the earlier ones.")
public record EvaluationCandidateResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) EvaluationBoardResponse.Candidate candidate,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Earlier assessments, the latest first.") List<Earlier> earlier) {

	@Schema(name = "EvaluationEarlier")
	public record Earlier(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "strong_match", "potential_match", "to_consider", "strong_no" }) String tier,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean provisional,
			@Schema(description = "Why its tier differed from the one before it.") @Nullable String changeNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant assessedAt) {
	}

}
