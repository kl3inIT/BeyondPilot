package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicUseCaseList", description = "One page of the public list of use cases.")
public record PublicUseCaseListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PublicUseCaseSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many use cases match, over all pages.") long total) {
}
