package ai.genaifund.beyondpilot.program.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "LumaRead",
		description = "What a read of the GenAI Fund calendar on Luma changed. An event that could not be read is tried again at the next read.")
public record LumaReadResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Events still to come that became programs.") int created,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Programs that took what Luma says now.") int updated,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Programs unpublished because their event left the calendar.") int unpublished,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Events that could not be read this time.") int failed) {
}
