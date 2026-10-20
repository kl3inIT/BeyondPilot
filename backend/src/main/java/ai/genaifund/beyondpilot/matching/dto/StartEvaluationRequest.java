package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "StartEvaluation", description = "An evaluation run of a program an operator starts.")
public record StartEvaluationRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "Whether every candidate is assessed again, whatever was assessed before.") boolean assessAll) {
}
