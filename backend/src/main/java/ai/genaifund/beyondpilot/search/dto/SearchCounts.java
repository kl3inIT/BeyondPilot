package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SearchCounts", description = "How many items of each kind match, whatever kind is shown.")
public record SearchCounts(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long all,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long program,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long solution,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long talent) {
}
