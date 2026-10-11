package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationList",
		description = "One page of organizations: those waiting for review first, then the newest.")
public record AdminOrganizationListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminOrganizationSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many organizations match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The countries the list can be narrowed by: those an organization is in, ISO 3166-1 alpha-2, in order.") List<String> countries) {
}
