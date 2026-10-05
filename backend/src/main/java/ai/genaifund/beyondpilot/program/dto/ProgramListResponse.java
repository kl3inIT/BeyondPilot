package ai.genaifund.beyondpilot.program.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ProgramList", description = "The published programs, the latest to start first.")
public record ProgramListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ProgramSummaryResponse> items) {
}
