package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReceivedUseCaseProposals", description = "The proposals a use case received, the latest first.")
public record ReceivedUseCaseProposalsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ProposalUseCaseResponse useCase,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ReceivedUseCaseProposalSummaryResponse> items) {
}
