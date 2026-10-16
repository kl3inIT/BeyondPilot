package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewCriterion", description = "One thing a program's applications are judged on, scored from 1 to 10.")
public record CriterionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }, description = "What a judge looks for.") @Nullable String description,
		@Schema(types = { "integer", "null" },
				description = "The criterion's weight: a score gives score / 10 × maxPoints. Null when the program's criteria have no points, and a score is the mean of the scores; always null for a judge, who never reads the weights.") @Nullable Integer maxPoints) {
}
