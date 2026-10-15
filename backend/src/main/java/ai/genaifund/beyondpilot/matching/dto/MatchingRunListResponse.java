package ai.genaifund.beyondpilot.matching.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MatchingRunList", description = "One page of the runs of every use case, the newest first.")
public record MatchingRunListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MatchingRunSummary> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many runs a page holds.") int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many runs there are, over all pages.") long total) {
}
