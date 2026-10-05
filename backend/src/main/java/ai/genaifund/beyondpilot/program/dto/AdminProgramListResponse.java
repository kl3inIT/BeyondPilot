package ai.genaifund.beyondpilot.program.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminProgramList", description = "Every program, the newest first.")
public record AdminProgramListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminProgramSummaryResponse> items) {
}
