package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminSolutionList",
		description = "One page of submitted solutions: those waiting for review first, the longest wait on top.")
public record AdminSolutionListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminSolutionSummaryResponse> items,
		@Schema(types = { "object", "null" },
				description = "The organization the list is narrowed to, for the filter to name; null when it is not.")
		@Nullable AdminSolutionOrganizationOptionResponse organization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions wait for review, whatever narrows this list.") long awaitingReview,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many customer deployments wait for review, whatever narrows this list.") long deploymentsAwaitingReview) {
}
