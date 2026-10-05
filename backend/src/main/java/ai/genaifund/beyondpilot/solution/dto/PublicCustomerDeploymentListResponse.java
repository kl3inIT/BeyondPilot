package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PublicCustomerDeploymentList", description = "One page of the customer deployments of an organization.")
public record PublicCustomerDeploymentListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PublicCustomerDeploymentResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total) {
}
