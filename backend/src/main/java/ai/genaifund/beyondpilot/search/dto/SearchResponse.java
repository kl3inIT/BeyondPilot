package ai.genaifund.beyondpilot.search.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SearchResults", description = "One page of what matches, best first, with the counts of every kind.")
public record SearchResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SearchCounts counts,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<SearchItem> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many items of the kind shown match, every kind when none is chosen.") long total) {
}
