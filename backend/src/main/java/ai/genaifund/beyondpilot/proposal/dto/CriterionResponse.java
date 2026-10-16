package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewCriterion", description = "One thing a program's applications are judged on, scored at one of five levels.")
public record CriterionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }, description = "What a judge looks for.") @Nullable String description,
		@Schema(types = { "integer", "null" },
				description = "The points the highest level gives; a level gives level × maxPoints / 5. Null when the program's criteria are not worth points, and a score is the mean of the levels.") @Nullable Integer maxPoints) {
}
