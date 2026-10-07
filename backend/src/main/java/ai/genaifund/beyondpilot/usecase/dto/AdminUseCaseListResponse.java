package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminUseCaseList", description = "One page of use cases, the newest first.")
public record AdminUseCaseListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminUseCaseSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many use cases match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many use cases in the whole system wait for GenAI Fund, whatever the filter.") long inReview) {
}
