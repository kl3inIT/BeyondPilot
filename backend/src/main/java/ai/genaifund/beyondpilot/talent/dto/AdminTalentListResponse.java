package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminTalentList",
		description = "One page of submitted talent profiles: those waiting for review first, the longest wait on top.")
public record AdminTalentListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TalentSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many profiles match, over all pages.") long total) {
}
