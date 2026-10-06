package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReviewCriteria", description = "What a program's applications are judged on, in order.")
public record CriteriaResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CriterionResponse> criteria,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an application has been scored on them, which fixes them.") boolean fixed) {
}
