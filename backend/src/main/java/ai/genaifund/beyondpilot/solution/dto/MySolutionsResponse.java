package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MySolutions", description = "The solutions of the caller's organization, the newest first.")
public record MySolutionsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<SolutionSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller may add and change solutions: an owner of an approved organization.") boolean editable) {
}
