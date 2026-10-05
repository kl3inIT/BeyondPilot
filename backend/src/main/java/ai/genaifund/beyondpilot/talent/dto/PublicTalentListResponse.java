package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicTalentList", description = "One page of the public directory of talent, by name.")
public record PublicTalentListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PublicTalentSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many profiles match, over all pages.") long total) {
}
