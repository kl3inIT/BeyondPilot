package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "StartMatchingRun", description = "A run of matching a person starts.")
public record StartRunRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether every candidate is judged again, whatever was judged before; only an operator may ask.") boolean judgeAll) {
}
