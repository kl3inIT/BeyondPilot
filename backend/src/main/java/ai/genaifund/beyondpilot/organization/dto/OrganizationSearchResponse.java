package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "OrganizationSearch", description = "The approved organizations a search finds, by name; ten at most.")
public record OrganizationSearchResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<OrganizationMatchResponse> items) {
}
