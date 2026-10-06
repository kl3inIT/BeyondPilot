package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseOrganizationList",
		description = "The approved organizations that can have use cases, by name; at most 50.")
public record UseCaseOrganizationListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UseCaseOrganizationResponse> items) {
}
