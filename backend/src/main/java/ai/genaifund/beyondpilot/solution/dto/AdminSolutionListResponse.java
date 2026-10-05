package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminSolutionList",
		description = "One page of submitted solutions: those waiting for review first, the longest wait on top.")
public record AdminSolutionListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<SolutionSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions match, over all pages.") long total) {
}
