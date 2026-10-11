package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseProposalCounts", description = "The number of proposals each asked use case received; one that received none is listed with 0.")
public record UseCaseProposalCountsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UseCaseProposalCountResponse> items) {
}
