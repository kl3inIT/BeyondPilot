package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicSolutionList", description = "One page of the public directory of solutions, by name.")
public record PublicSolutionListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PublicSolutionSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions match, over all pages.") long total) {
}
