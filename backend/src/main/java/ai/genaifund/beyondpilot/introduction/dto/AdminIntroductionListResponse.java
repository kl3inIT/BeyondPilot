package ai.genaifund.beyondpilot.introduction.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminIntroductionList",
		description = "One page of requests for an introduction: those that wait first, the longest wait on top.")
public record AdminIntroductionListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminIntroductionResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many requests match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many requests, whatever the filter, have waited longer than three days.") long overdue) {
}
